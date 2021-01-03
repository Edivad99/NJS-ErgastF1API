FROM mysql:8.0.22

RUN apt-get update && apt-get install -y wget && apt-get clean

RUN wget http://ergast.com/downloads/f1db.sql.gz -P /docker-entrypoint-initdb.d
RUN gunzip /docker-entrypoint-initdb.d/f1db.sql.gz
