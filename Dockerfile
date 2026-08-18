FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies first so this layer stays cached unless requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Rest of the app (templates/, static/, app.py, db.py, claude_client.py, file_parser.py)
COPY . .

RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

# Single worker: Flask-Limiter's in-memory rate-limit counters aren't shared
# across processes, so more workers would silently multiply the effective
# limits. Move to Redis-backed storage (see the Limiter config in app.py)
# before scaling workers.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "app:app"]
