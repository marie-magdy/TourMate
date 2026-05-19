"""Shared pytest setup: put cv_service/ on sys.path so `import app` works
regardless of where pytest is invoked from.
"""
import os
import sys

CV_SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if CV_SERVICE_DIR not in sys.path:
    sys.path.insert(0, CV_SERVICE_DIR)
