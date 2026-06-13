from rest_framework.viewsets import ModelViewSet
from core.models import Product
from core.permissions import ReadOnlyOrAdmin
from api.serializers.product_serializers import ProductSerializer

class ProductViewSet(ModelViewSet):
    serializer_class   = ProductSerializer
    permission_classes = [ReadOnlyOrAdmin]

    def get_queryset(self):
        qs = Product.objects.select_related('category').filter(is_active=True)
        category = self.request.query_params.get('category')
        search   = self.request.query_params.get('search')
        if category:
            qs = qs.filter(category_id=category)
        if search:
            qs = qs.filter(name__icontains=search)
        return qs
