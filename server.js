// Setting up required components
/* ----------------------------------------------------------------- */
var http = require('http'),
    path = require('path'),
	PORT = process.env.PORT || 5000,
    express = require('express'),
    app = express(),
    socketio = require('socket.io'),
    server, io, players, highScores;

// Setting up express for routing

app.set('views',path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// Routing
/* ----------------------------------------------------------------- */
app.get('/', function (req, res) {
    res.render('index');
});

app.get('/game', function (req, res) {
    res.render('game');
});

// Socket.io: Setting up multiplayer
/* ----------------------------------------------------------------- */

server = http.createServer(app);
io = socketio.listen(server);
players = {};
highScores = {};

io.set('log level', 0);

// Socket.io: Setting up event handlers for all the messages that come
// in from the client (check out /public/js/game.js and /views/game.jade
// for that).

io.on('connection', function (socket) {
    socket.on('disconnect', function () {
        socket.broadcast.emit('removePlayer', socket.sessionId);
        delete players[socket.sessionId];
        delete highScores[socket.sessionId];
        io.sockets.emit('highScores', highScores);
    });

    socket.on('gameReady', function (data) {
        socket.sessionId = data.id;
        socket.playerName = data.name;

        if (players[data.id]) {
            socket.broadcast.emit('removePlayer', socket.sessionId);
            delete players[socket.sessionId];
            delete highScores[socket.sessionId];
            io.sockets.emit('highScores', highScores);
        }

        var player = {
            id: data.id,
            z: 6,
            health: 3,
            score: 0,
            p: {
                x: 8 * 48,
                y: 2 * 48
            },
            n: socket.playerName
        };

        highScores[data.id] = {
            name: socket.playerName,
            score: 0
        };

        socket.broadcast.emit('addPlayer', player);
        players[data.id] = player;
        socket.emit('playerId', data.id);
        socket.emit('addMainPlayer', player);
        socket.emit('addPlayers', players);
        io.sockets.emit('highScores', highScores);
    });

    socket.on('updatePlayerState', function (position, state) {
        if (!players[socket.sessionId]) {
            return;
        }

        players[socket.sessionId].p = position;
        socket.broadcast.emit('updatePlayerState', {
            id: socket.sessionId,
            p: position,
            s: state
        });
    });

    socket.on('fireBullet', function (id, source, target) {
        socket.broadcast.emit('fireBullet', id, source, target);
    });

    socket.on('playerHit', function (data) {
        socket.broadcast.emit('remotePlayerHit', data);
    });

    socket.on('scoreHit', function () {
        var player = players[socket.sessionId];
        if (!player) {
            return;
        }
        player.score = player.score ? player.score + 100 : 100;
        socket.emit('score', player.score);
        highScores[player.id] = {
            name: player.n,
            score: player.score
        };
        io.sockets.emit('highScores', highScores);
    });

    socket.on('resetPlayer', function () {
        var player = {
            id: socket.sessionId,
            z: 6,
            score: 0,
            health: 3,
            p: {
                x: 8 * 48,
                y: 2 * 48
            },
            n: socket.playerName
        };
        socket.broadcast.emit('removePlayer', player.id);
        socket.broadcast.emit('addPlayer', player);
        socket.emit('addMainPlayer', player);
    });

    socket.on('playerHealed', function (data) {
        socket.broadcast.emit('remotePlayerHealed', data);
    });
});

// ...and actually starting the server!
/* ----------------------------------------------------------------- */

app.listen(PORT);
