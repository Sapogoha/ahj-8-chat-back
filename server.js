const http = require('http');
const Koa = require('koa');
const WS = require('ws');
const cors = require('@koa/cors');
const { v4: uuid } = require('uuid');
const app = new Koa();

app.use(
  cors({
    origin: '*',
    credentials: true,
    'Access-Control-Allow-Origin': true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server });
const users = [];
const messages = [];

wsServer.on('connection', (ws) => {
  ws.on('message', (msg) => {
    const command = JSON.parse(msg);

    if (command.event === 'newUser') {
      const hasUsername = users.find(
        (user) => user.username === command.message
      );

      if (hasUsername) {
        ws.send(JSON.stringify({ event: 'error', error: 'taken' }));
      } else {
        const username = command.message;
        const id = uuid();

        users.push({ username, id, connection: ws });
        const userList = users.map((user) => user.username);
        const idList = users.map((user) => user.id);

        ws.send(
          JSON.stringify({ event: 'connect', users: userList, ids: idList })
        );

        Array.from(wsServer.clients)
          .filter((o) => o.readyState === WS.OPEN)
          .forEach((o) => {
            o.send(
              JSON.stringify({
                event: 'notification - entered',
                notification: `User ${username} entered the chat`,
                newUser: username,
                id,
              })
            );
          });
      }
    }
    if (command.event === 'newMessage') {
      const { message, username, timestamp } = command;
      const id = users.find((user) => user.username === username).id;
      messages.push({ username, id, message, timestamp });

      Array.from(wsServer.clients)
        .filter((o) => o.readyState === WS.OPEN)
        .forEach((o) => {
          o.send(
            JSON.stringify({
              event: 'newMessage',
              message,
              username,
              id,
              timestamp,
            })
          );
        });
    }
  });

  ws.on('close', () => {
    const left = users.find((user) => user.connection === ws);
    const leftIndex = users.findIndex(
      (user) => user.username === left.username
    );
    users.splice(leftIndex, 1);
    Array.from(wsServer.clients)
      .filter((o) => o.readyState === WS.OPEN)
      .forEach((o) => {
        o.send(
          JSON.stringify({
            event: 'notification - left',
            notification: `User ${left.username} left the chat`,
            leftUser: left.username,
            id: left.id,
          })
        );
      });
  });
});

server.listen(port, () => console.log('Server started'));
