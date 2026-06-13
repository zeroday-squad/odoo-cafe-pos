from rest_framework.routers import DefaultRouter
from api.views.category_views import CategoryViewSet

router = DefaultRouter()
router.register('', CategoryViewSet, basename='category')
urlpatterns = router.urls
