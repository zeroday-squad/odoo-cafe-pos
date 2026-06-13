from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from core.models import PaymentMethod
from api.serializers.payment_serializers import PaymentMethodSerializer

class PaymentMethodViewSet(ModelViewSet):
    queryset           = PaymentMethod.objects.all()
    serializer_class   = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'put', 'patch', 'head', 'options']
