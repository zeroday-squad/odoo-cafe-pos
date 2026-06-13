from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from api.views.coupon_views import CouponViewSet, CouponValidateView, PromotionViewSet

coupon_list = CouponViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
coupon_detail = CouponViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})

promo_list = PromotionViewSet.as_view({
    'get': 'list',
    'post': 'create'
})
promo_detail = PromotionViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})

@csrf_exempt
def dispatch_list(request, *args, **kwargs):
    if 'coupons' in request.path:
        return coupon_list(request, *args, **kwargs)
    return promo_list(request, *args, **kwargs)

@csrf_exempt
def dispatch_detail(request, *args, **kwargs):
    if 'coupons' in request.path:
        return coupon_detail(request, *args, **kwargs)
    return promo_detail(request, *args, **kwargs)

urlpatterns = [
    path('validate/', CouponValidateView.as_view()),
    path('', dispatch_list),
    path('<uuid:pk>/', dispatch_detail),
]
