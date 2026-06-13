from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.models import Coupon, Promotion
from core.permissions import IsAdminUser, IsEmployeeOrAdmin, ReadOnlyOrAdmin
from api.serializers.coupon_serializers import (
    CouponSerializer, PromotionSerializer
)

class CouponViewSet(ModelViewSet):
    queryset           = Coupon.objects.all()
    serializer_class   = CouponSerializer
    permission_classes = [IsAdminUser]


class CouponValidateView(APIView):
    """
    POST /api/coupons/validate/
    Body: { "code": "SAVE10" }
    Used by cashier at POS to check if a coupon code is valid before applying.
    """
    permission_classes = [IsEmployeeOrAdmin]

    def post(self, request):
        code = request.data.get('code', '').upper().strip()
        if not code:
            return Response({'error': 'Coupon code is required.'}, status=400)
        coupon = Coupon.objects.filter(code=code, is_active=True).first()
        if not coupon:
            return Response({'error': 'Invalid or expired coupon code.'}, status=404)
        return Response({
            'id':             str(coupon.id),
            'code':           coupon.code,
            'discount_type':  coupon.discount_type,
            'discount_value': str(coupon.discount_value),
        })


class PromotionViewSet(ModelViewSet):
    """
    GET is allowed for any authenticated user (cashier reads at POS startup).
    Write operations are admin only (enforced by ReadOnlyOrAdmin).
    Supports ?is_active=true filter.
    """
    serializer_class   = PromotionSerializer
    permission_classes = [ReadOnlyOrAdmin]

    def get_queryset(self):
        qs = Promotion.objects.select_related('product').all()
        if self.request.query_params.get('is_active') == 'true':
            qs = qs.filter(is_active=True)
        return qs
