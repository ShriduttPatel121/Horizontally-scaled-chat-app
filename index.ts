import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from 'redis';

const publishClient = createClient();
publishClient.connect();

const subscribeClient = createClient();
subscribeClient.connect();

const wss = new WebSocketServer({ port: 8080 });

const subscription: {
    [key: string]: {
        ws: WebSocket,
        rooms: string[],
    }
} = {};

    wss.on('connection', function connection(userSocket) {
        userSocket.on('error', console.error);

        const id = randomId();
        subscription[id] = {
            ws: userSocket,
            rooms: []
        }
        userSocket.on('message', function message(data) {
            const parsedMessage = JSON.parse(data as unknown as string);

            if(parsedMessage.type === 'SUBSCRIBE') {
                subscription[id].rooms.push(parsedMessage.room);
                // console.log("🚀 ~ message ~ oneUserSubscribedTo(parsedMessage.room):", oneUserSubscribedTo(parsedMessage.room))
                if(oneUserSubscribedTo(parsedMessage.room)) {
                    subscribeClient.subscribe(parsedMessage.room, (message) => {
                        const { roomId } = JSON.parse(message);
                        Object.keys(subscription).forEach((userID) => {
                            const {ws, rooms} = subscription[userID];
                            if(rooms.includes(roomId)) {
                                ws.send(message);
                            }
                        })
                    })
                }
            }

            if(parsedMessage.type === "UNSUBSCRIBE") {
                const roomId = parsedMessage.room;
                subscription[id].rooms = subscription[id].rooms.filter(room => room !== roomId);
                if(lastPersonInRoom(roomId)) {
                    console.log("🚀 ~ message ~ roomId: ROOM EMPTY", roomId)
                    subscribeClient.unsubscribe(roomId) // when close event happen we need to run same logic in that too
                }
            }

            if(parsedMessage.type === 'sendMessage') {
                const message = parsedMessage.message;
                const roomId = parsedMessage.room;
                console.log("🚀 ~ message ~ roomId:", roomId)

                // Object.keys(subscription).forEach((userID) => {
                //     const { ws, rooms } = subscription[userID];
                //     if(rooms.includes(roomId)) {
                //         ws.send(message);
                //     }
                // })
                publishClient.publish(roomId, JSON.stringify({
                    type: 'sendMessage',
                    message: message,
                    roomId: roomId
                }))
            }
        });

        userSocket.send('something');
    });

function randomId() {
    return (Math.random())
}

function oneUserSubscribedTo(roomId: string) {
    let totalPeople = 0;
    Object.keys(subscription).forEach(userId => {
        if(subscription[userId].rooms.includes(roomId)) {
            totalPeople += 1;
        }
    });

    console.log("🚀 ~ oneUserSubscribedTo ~ totalPeople:", totalPeople)
    return totalPeople === 1;
}

function lastPersonInRoom(roomId: string) {
    const userIds = Object.keys(subscription);
    let interestedUsers = 0
    for (const userId of userIds) {
        const { rooms } = subscription[userId];
        if(rooms.includes(roomId)) {
            interestedUsers++;
        }
    }
    return interestedUsers === 0;
}