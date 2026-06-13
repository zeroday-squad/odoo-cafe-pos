from rest_framework.routers import DefaultRouter
from api.views.staff_views import StaffViewSet

router = DefaultRouter()
router.register('', StaffViewSet, basename='user')
urlpatterns = router.urls
