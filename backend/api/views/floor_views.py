from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.db import IntegrityError
from core.models import Floor, Table
from core.permissions import IsAdminUser, ReadOnlyOrAdmin
from api.serializers.floor_serializers import FloorSerializer, TableSerializer

class FloorViewSet(ModelViewSet):
    queryset           = Floor.objects.prefetch_related('tables').all()
    serializer_class   = FloorSerializer
    permission_classes = [IsAdminUser]

class TableViewSet(ModelViewSet):
    serializer_class   = TableSerializer
    permission_classes = [ReadOnlyOrAdmin]

    def get_queryset(self):
        qs = Table.objects.select_related('floor').all()
        if self.request.query_params.get('is_active') == 'true':
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise DRFValidationError(
                {'detail': 'A table with this number already exists on this floor.'}
            )

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise DRFValidationError(
                {'detail': 'A table with this number already exists on this floor.'}
            )
