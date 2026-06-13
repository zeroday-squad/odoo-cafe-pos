from django.urls import path
from api.views.session_views import CurrentSessionView, OpenSessionView, CloseSessionView

urlpatterns = [
    path('current/', CurrentSessionView.as_view()),
    path('open/',    OpenSessionView.as_view()),
    path('close/',   CloseSessionView.as_view()),
]
