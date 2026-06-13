from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsAdminUser(BasePermission):
    """Allows access only to users with role='admin'."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role == 'admin')

class IsEmployeeOrAdmin(BasePermission):
    """Allows access to cashiers and admins. Used for POS operations."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ['admin', 'cashier'])

class IsKitchenOrAdmin(BasePermission):
    """Allows access to kitchen staff and admins. Used for KDS endpoints."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated
                    and request.user.role in ['admin', 'kitchen'])

class ReadOnlyOrAdmin(BasePermission):
    """
    GET/HEAD/OPTIONS: allowed for ANY authenticated user.
    POST/PUT/PATCH/DELETE: allowed only for admin.
    Used for: Products, Categories (cashier can read, admin writes).
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role == 'admin'
