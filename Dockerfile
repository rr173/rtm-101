FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html /usr/share/nginx/html/
COPY analyzer.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY chord-trainer /usr/share/nginx/html/chord-trainer/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
