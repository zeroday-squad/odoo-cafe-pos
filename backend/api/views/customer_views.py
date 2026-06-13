from django.db.models import Q
from rest_framework.viewsets import ModelViewSet
from core.models import Customer
from core.permissions import IsEmployeeOrAdmin
from api.serializers.customer_serializers import CustomerSerializer

class CustomerViewSet(ModelViewSet):
    permission_classes = [IsEmployeeOrAdmin]
    serializer_class = CustomerSerializer

    def get_queryset(self):
        queryset = Customer.objects.all().order_by('name')
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search)
            )
        return queryset
