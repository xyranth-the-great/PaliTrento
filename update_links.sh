#!/bin/bash
# Update HTML links for clean URLs (directory-based)

# Map of old -> new links
# Note: index.html becomes root /

files=(
  "index.html"
  "explore.html"
  "map.html"
  "products.html"
  "business.html"
  "register.html"
  "login.html"
  "account.html"
  "verify.html"
  "register-business.html"
  "store-setup.html"
  "dashboard.html"
  "chat.html"
  "admin.html"
  "admin-verification.html"
  "admin-prices.html"
  "admin-reports.html"
  "product-detail.html"
  "standee.html"
  "orders.html"
  "settings.html"
  "forgot-password.html"
  "reset-password.html"
  "terms-and-agreement.html"
)

for f in "${files[@]}"; do
  if [ -f "$f" ]; then
    echo "Updating $f..."
    
    # Replace .html links with directory paths
    sed -i 's|href="index\.html"|href="/"|g' "$f"
    sed -i 's|href="explore\.html"|href="/explore/"|g' "$f"
    sed -i 's|href="map\.html"|href="/map/"|g' "$f"
    sed -i 's|href="products\.html"|href="/products/"|g' "$f"
    sed -i 's|href="business\.html"|href="/business/"|g' "$f"
    sed -i 's|href="register\.html"|href="/register/"|g' "$f"
    sed -i 's|href="login\.html"|href="/login/"|g' "$f"
    sed -i 's|href="account\.html"|href="/account/"|g' "$f"
    sed -i 's|href="verify\.html"|href="/verify/"|g' "$f"
    sed -i 's|href="register-business\.html"|href="/register-business/"|g' "$f"
    sed -i 's|href="store-setup\.html"|href="/store-setup/"|g' "$f"
    sed -i 's|href="dashboard\.html"|href="/dashboard/"|g' "$f"
    sed -i 's|href="chat\.html"|href="/chat/"|g' "$f"
    sed -i 's|href="admin\.html"|href="/admin/"|g' "$f"
    sed -i 's|href="admin-verification\.html"|href="/admin-verification/"|g' "$f"
    sed -i 's|href="admin-prices\.html"|href="/admin-prices/"|g' "$f"
    sed -i 's|href="admin-reports\.html"|href="/admin-reports/"|g' "$f"
    sed -i 's|href="product-detail\.html"|href="/product-detail/"|g' "$f"
    sed -i 's|href="standee\.html"|href="/standee/"|g' "$f"
    sed -i 's|href="orders\.html"|href="/orders/"|g' "$f"
    sed -i 's|href="settings\.html"|href="/settings/"|g' "$f"
    sed -i 's|href="forgot-password\.html"|href="/forgot-password/"|g' "$f"
    sed -i 's|href="reset-password\.html"|href="/reset-password/"|g' "$f"
    sed -i 's|href="terms-and-agreement\.html"|href="/terms-and-agreement/"|g' "$f"
    
    # Also handle action attributes in forms
    sed -i 's|action="index\.html"|action="/"|g' "$f"
    sed -i 's|action="explore\.html"|action="/explore/"|g' "$f"
    sed -i 's|action="map\.html"|action="/map/"|g' "$f"
    sed -i 's|action="products\.html"|action="/products/"|g' "$f"
    sed -i 's|action="business\.html"|action="/business/"|g' "$f"
    sed -i 's|action="register\.html"|action="/register/"|g' "$f"
    sed -i 's|action="login\.html"|action="/login/"|g' "$f"
    sed -i 's|action="account\.html"|action="/account/"|g' "$f"
    sed -i 's|action="verify\.html"|action="/verify/"|g' "$f"
    sed -i 's|action="register-business\.html"|action="/register-business/"|g' "$f"
    sed -i 's|action="store-setup\.html"|action="/store-setup/"|g' "$f"
    sed -i 's|action="dashboard\.html"|action="/dashboard/"|g' "$f"
    sed -i 's|action="chat\.html"|action="/chat/"|g' "$f"
    sed -i 's|action="admin\.html"|action="/admin/"|g' "$f"
    sed -i 's|action="admin-verification\.html"|action="/admin-verification/"|g' "$f"
    sed -i 's|action="admin-prices\.html"|action="/admin-prices/"|g' "$f"
    sed -i 's|action="admin-reports\.html"|action="/admin-reports/"|g' "$f"
    sed -i 's|action="product-detail\.html"|action="/product-detail/"|g' "$f"
    sed -i 's|action="standee\.html"|action="/standee/"|g' "$f"
    sed -i 's|action="orders\.html"|action="/orders/"|g' "$f"
    sed -i 's|action="settings\.html"|action="/settings/"|g' "$f"
    sed -i 's|action="forgot-password\.html"|action="/forgot-password/"|g' "$f"
    sed -i 's|action="reset-password\.html"|action="/reset-password/"|g' "$f"
    sed -i 's|action="terms-and-agreement\.html"|action="/terms-and-agreement/"|g' "$f"
  fi
done

echo "HTML links updated!"
