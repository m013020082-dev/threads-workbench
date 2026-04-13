FROM node:20-alpine
WORKDIR /app
COPY dist/ ./dist/
RUN npm install -g serve
CMD sh -c "serve dist -p ${PORT:-3000} --single"
