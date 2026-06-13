from rest_framework.routers import DefaultRouter
from api.views.product_views import ProductViewSet

router = DefaultRouter()
router.register('', ProductViewSet, basename='product')
urlpatterns = router.urls
