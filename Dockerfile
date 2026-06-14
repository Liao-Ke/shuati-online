FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
ARG PIP_INDEX_URL=https://pypi.org/simple
RUN mkdir -p /app/data && pip install --no-cache-dir -r requirements.txt -i $PIP_INDEX_URL

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
