FROM mysql:latest

RUN sed -i -e"s/^bind-address\s*=\s*127.0.0.1/bind-address=0.0.0.0/" /etc/mysql/my.cnf

#RUN mysql -u root "ALTER USER 'root'@'%' IDENTIFIED BY 'f1'";
#RUN mysql -u root ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'f1';;
#flush privileges;

RUN apt-get update && apt-get install -y wget && apt-get clean

#ADD data/f1db.sql.gz /docker-entrypoint-initdb.d/f1db.sql.gz

RUN wget http://ergast.com/downloads/f1db.sql.gz -P /docker-entrypoint-initdb.d
RUN gunzip /docker-entrypoint-initdb.d/f1db.sql.gz

#RUN mysql -u root -p
#RUN ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'f1';
#RUN flush privileges;
#RUN quit
