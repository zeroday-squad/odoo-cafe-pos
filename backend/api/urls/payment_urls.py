from rest_framework.routers import DefaultRouter
from api.views.payment_views import PaymentMethodViewSet

router = DefaultRouter()
router.register('', PaymentMethodViewSet, basename='payment-method')
urlpatterns = router.urls
