FROM quay.io/qasimtech/mega-md:latest

WORKDIR /root/mega-md

COPY package.json package-lock.json ./
COPY scripts ./scripts

RUN npm install

COPY . .

# Compile the native utilities into the image, not on the production runtime CPU.
RUN node --input-type=module -e 'import("./lib/compile.js").then(async ({ compileAll, getBin }) => { await compileAll(); const fs = await import("node:fs"); for (const name of ["dna", "cipher", "rle", "analyze"]) if (!fs.existsSync(getBin(name))) throw new Error("Missing compiled binary: " + name); })'

EXPOSE 5000

CMD ["npm", "run", "start:optimized"]
