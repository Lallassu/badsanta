FROM node:alpine

# Create app directory
RUN mkdir -p /usr/src/badsanta/
WORKDIR /usr/src/badsanta

# Install app dependencies
COPY package.json /usr/src/badsanta/
RUN npm install --production

# Bundle app source
ADD dist /usr/src/badsanta/

EXPOSE 8000
CMD [ "npm", "start" ]
