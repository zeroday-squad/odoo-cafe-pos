from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/',            include('api.urls.auth_urls')),
    path('api/products/',        include('api.urls.product_urls')),
    path('api/categories/',      include('api.urls.category_urls')),
    path('api/floors/',          include('api.urls.floor_urls')),
    path('api/tables/',          include('api.urls.floor_urls')),   # same file, both routers inside
    path('api/payment-methods/', include('api.urls.payment_urls')),
    path('api/coupons/',         include('api.urls.coupon_urls')),
    path('api/promotions/',      include('api.urls.coupon_urls')),  # same file
    path('api/users/',           include('api.urls.staff_urls')),
    path('api/sessions/',        include('api.urls.session_urls')), # Phase 2 stub
    path('api/orders/',          include('api.urls.order_urls')),   # Phase 2 stub
    path('api/customers/',       include('api.urls.customer_urls')),# Phase 2 stub
    path('api/kds/',             include('api.urls.kds_urls')),     # Phase 2 stub
    path('api/reports/',         include('api.urls.report_urls')),
]
