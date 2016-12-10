FROM node:alpine

# Create app directory
RUN mkdir -p /usr/src/badsanta/
WORKDIR /usr/src/badsanta

# Install app dependencies
COPY package.json /usr/src/badsanta/
RUN npm install --production

# Bundle app source
ADD dist /usr/src/badsanta/
#COPY dist/* /usr/src/badsanta/
#COPY dist/share /usr/src/badsanta/share
#COPY dist/assets /usr/src/badsanta/assets
#COPY dist/server /usr/src/badsanta/server

EXPOSE 8000
CMD [ "npm", "start" ]
