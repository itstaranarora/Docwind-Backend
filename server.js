const mongoose = require("mongoose");
const Document = require("./Document");
require("dotenv").config();

mongoose.connect(process.env.DATABASE_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

const defaultValue = "";

const io = require("socket.io")(3001, {
  cors: {
    origin: process.env.APP_URL,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.emit("me", socket.id);

  socket.on("get-document", async (documentId) => {
    const document = await findOrCreateDocument(documentId);
    socket.join(documentId);
    socket.emit("load-document", document.data);

    socket.on("send-changes", (delta) => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    socket.on("save-document", async (data) => {
      await Document.findByIdAndUpdate(documentId, { data });
    });

    socket.on("disconnect", () => {
      socket.to(documentId).emit("callEnded");
    });

    socket.on("callUser", ({ signalData }) => {
      socket.broadcast.to(documentId).emit("callUser", { signal: signalData });
    });

    socket.on("answerCall", (data) => {
      socket.broadcast.to(documentId).emit("callAccepted", data.signal);
    });
  });
});

async function findOrCreateDocument(id) {
  if (id == null) return;

  const document = await Document.findById(id);

  if (document) return document;

  return await Document.create({ _id: id, data: defaultValue });
}
