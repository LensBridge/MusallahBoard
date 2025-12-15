#!/bin/bash
# Raspberry Pi Kiosk Setup Script
# Run as the musallah user: bash setup_kiosk.sh

set -e

echo "=== Raspberry Pi Kiosk Setup ==="
echo "This script will configure:"
echo "- Admin user: ibratech (SSH only, key-based auth, sudo access)"
echo "- Current user (musallah) as kiosk (auto-login, Chromium only, no sudo)"
echo ""

# Get current user
CURRENT_USER=$(whoami)

if [ "$CURRENT_USER" = "root" ]; then
    echo "Error: Do not run this script as root"
    echo "Run as the musallah user"
    exit 1
fi

if [ "$CURRENT_USER" != "musallah" ]; then
    echo "Warning: Expected to run as 'musallah' user, but running as '$CURRENT_USER'"
    echo "This user will become the kiosk user."
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Current user: $CURRENT_USER"
echo "This user will be configured as the kiosk user"
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Configuration
ADMIN_USER="ibra"
KIOSK_USER="$CURRENT_USER"
KIOSK_URL_FILE="/home/$KIOSK_USER/url.txt"
DEFAULT_URL="http://10.0.0.75:3000"

# Check if user has sudo access currently (they'll need it to run the script)
if ! sudo -n true 2>/dev/null; then
    echo "Error: Current user needs sudo access to run this script"
    echo "After setup, sudo access will be removed from $KIOSK_USER"
    exit 1
fi

# Get SSH public key for admin user
echo ""
echo "=== Admin User Setup ==="
read -p "Enter SSH public key for $ADMIN_USER (paste entire key): " SSH_PUB_KEY

if [ -z "$SSH_PUB_KEY" ]; then
    echo "Error: SSH public key is required"
    exit 1
fi

# Create admin user
echo "Creating admin user: $ADMIN_USER"
if id "$ADMIN_USER" &>/dev/null; then
    echo "User $ADMIN_USER already exists"
else
    sudo useradd -m -s /bin/bash "$ADMIN_USER"
    echo "User $ADMIN_USER created"
fi

# Set up SSH for admin user
sudo mkdir -p /home/$ADMIN_USER/.ssh
sudo chmod 700 /home/$ADMIN_USER/.ssh
echo "$SSH_PUB_KEY" | sudo tee /home/$ADMIN_USER/.ssh/authorized_keys > /dev/null
sudo chmod 600 /home/$ADMIN_USER/.ssh/authorized_keys
sudo chown -R $ADMIN_USER:$ADMIN_USER /home/$ADMIN_USER/.ssh

# Add admin to sudo group
sudo usermod -aG sudo $ADMIN_USER
echo "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/$ADMIN_USER > /dev/null
sudo chmod 440 /etc/sudoers.d/$ADMIN_USER

echo "Admin user $ADMIN_USER configured with SSH key authentication"

# Configure current user as kiosk user
echo ""
echo "=== Kiosk User Setup ==="
echo "Configuring current user ($KIOSK_USER) as kiosk user"

# Remove kiosk user from sudo group
sudo deluser $KIOSK_USER sudo 2>/dev/null || true
# Remove sudo file if it exists
sudo rm -f /etc/sudoers.d/$KIOSK_USER

# Lock kiosk user password (no password login)
sudo passwd -l $KIOSK_USER

# Create kiosk URL file
echo "Creating URL configuration file at $KIOSK_URL_FILE"
echo "$DEFAULT_URL" > "$KIOSK_URL_FILE"
chmod 644 "$KIOSK_URL_FILE"

echo "Kiosk user $KIOSK_USER configured (no sudo, locked password)"
echo "Default URL set to: $DEFAULT_URL"
echo "URL file location: $KIOSK_URL_FILE"

# Install required packages
echo ""
echo "=== Installing Required Packages ==="
sudo apt-get update
sudo apt-get install -y \
    chromium \
    xdotool \
    unclutter \
    lightdm \
    openbox \
    xinit

# Configure auto-login for kiosk user
echo "Configuring auto-login for $KIOSK_USER"
sudo mkdir -p /etc/lightdm/lightdm.conf.d
cat << EOF | sudo tee /etc/lightdm/lightdm.conf.d/autologin.conf > /dev/null
[Seat:*]
autologin-user=$KIOSK_USER
autologin-user-timeout=0
EOF

# Create openbox autostart for kiosk user
echo "Setting up kiosk environment"
mkdir -p ~/.config/openbox
cat > ~/.config/openbox/autostart << 'EOF'
#!/bin/bash
# Disable screen blanking and power management
xset s off
xset s noblank

# Hide cursor when idle
unclutter -idle 0.1 &

# Read URL from file
KIOSK_URL=$(cat /home/musallah/url.txt 2>/dev/null || echo "https://www.example.com")

# Wait for network
sleep 5

# Launch Chromium in kiosk mode
chromium-browser \
  --kiosk "$KIOSK_URL" \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --check-for-update-interval=31536000 \
  --disable-features=TranslateUI \
  --disk-cache-dir=/dev/null \
  --disk-cache-size=1 &
EOF

chmod +x ~/.config/openbox/autostart

# Create xinitrc for kiosk user
cat > ~/.xinitrc << 'EOF'
#!/bin/bash
exec openbox-session
EOF

chmod +x ~/.xinitrc

# Restrict kiosk user shell access
echo "Restricting $KIOSK_USER shell capabilities"
cat > ~/.bashrc << 'EOF'
# Restricted kiosk user shell
# This user should only access the system via GUI auto-login
echo "This account is restricted. GUI access only."
exit
EOF

# Configure SSH security
echo ""
echo "=== Securing SSH ==="
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Secure SSH configuration
cat << EOF | sudo tee /etc/ssh/sshd_config.d/kiosk_security.conf > /dev/null
# Disable password authentication
PasswordAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes

# Disable root login
PermitRootLogin no

# Only allow admin user SSH access
AllowUsers $ADMIN_USER

# Deny kiosk user SSH access
DenyUsers $KIOSK_USER
EOF

# Restart SSH service
sudo systemctl restart ssh

echo "SSH configured: key-based auth only, $ADMIN_USER access only"

# Set up firewall (optional but recommended)
echo ""
echo "=== Firewall Setup (optional) ==="
read -p "Do you want to set up a basic firewall with ufw? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo apt-get install -y ufw
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw --force enable
    echo "Firewall enabled (SSH allowed)"
fi

# Final permissions check
echo ""
echo "=== Final Security Hardening ==="
# Ensure kiosk user home directory permissions
chmod 755 /home/$KIOSK_USER

# Remove unnecessary groups from kiosk user
for group in adm dialout cdrom plugdev games users input netdev; do
    sudo deluser $KIOSK_USER $group 2>/dev/null || true
done

# Keep audio and video groups for Chromium multimedia
echo "Keeping audio/video groups for multimedia support"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Configuration Summary:"
echo "---------------------"
echo "Admin User: $ADMIN_USER"
echo "  - SSH access with public key authentication"
echo "  - Sudo permissions"
echo "  - Password authentication disabled"
echo ""
echo "Kiosk User: $KIOSK_USER (musallah)"
echo "  - Auto-login to GUI"
echo "  - Chromium kiosk mode"
echo "  - No sudo permissions (REMOVED)"
echo "  - SSH access denied"
echo "  - Shell access restricted"
echo ""
echo "Kiosk URL: $KIOSK_URL_FILE"
echo "  Edit this file as ibratech to change the URL"
echo "  Example: ssh ibratech@pi-ip"
echo "           sudo nano /home/musallah/url.txt"
echo ""
echo "⚠️  IMPORTANT: After reboot, you will NOT be able to:"
echo "   - SSH as $KIOSK_USER"
echo "   - Use sudo as $KIOSK_USER"
echo "   - Access terminal as $KIOSK_USER"
echo ""
echo "   You MUST SSH as $ADMIN_USER to manage this system!"
echo ""
echo "IMPORTANT: Reboot required for changes to take effect"
read -p "Reboot now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo reboot
fi