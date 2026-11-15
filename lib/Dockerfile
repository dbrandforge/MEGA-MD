FROM quay.io/qasimtech/mega-md:latest

WORKDIR /root/mega-md

COPY package.json package-lock.json ./
COPY scripts ./scripts

RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "run", "start:optimized"]
