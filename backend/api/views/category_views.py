from rest_framework.viewsets import ModelViewSet
from core.models import Category
from core.permissions import ReadOnlyOrAdmin
from api.serializers.category_serializers import CategorySerializer

class CategoryViewSet(ModelViewSet):
    queryset           = Category.objects.all()
    serializer_class   = CategorySerializer
    permission_classes = [ReadOnlyOrAdmin]
