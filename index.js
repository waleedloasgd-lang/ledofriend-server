const socketHandler = (io, db) => {
  const activeUsers = new Map();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('authenticate', (data) => {
      activeUsers.set(socket.id, { userId: data.userId });
      socket.join(`user_${data.userId}`);
    });

    socket.on('session:start', (data) => {
      const user = activeUsers.get(socket.id);
      if (user) io.to(`user_${user.userId}`).emit('session:started', data);
    });

    socket.on('session:complete', (data) => {
      const user = activeUsers.get(socket.id);
      if (user) io.to(`user_${user.userId}`).emit('session:completed', data);
    });

    socket.on('settings:sync', async (data) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;
      try {
        await db.collection('settings').doc(user.userId).update(data);
        socket.emit('settings:synced', { success: true });
      } catch (e) {
        socket.emit('settings:synced', { success: false });
      }
    });

    socket.on('disconnect', () => {
      activeUsers.delete(socket.id);
    });
  });
};

module.exports = socketHandler;
