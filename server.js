const app = require("express")();
const mongoose = require("mongoose");
const Document = require("./Document");
const cors = require("cors");
const server = require("http").createServer(app);
require("dotenv").config();

mongoose.connect(process.env.DATABASE_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

const defaultValue = "";

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const PORT = process.env.PORT || 3001;

app.get("/", (req, res) => {
  res.send("Running");
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

server.listen(PORT, () => console.log("Server is running on port " + PORT));

async function findOrCreateDocument(id) {
  if (id == null) return;

  const document = await Document.findById(id);

  if (document) return document;

  return await Document.create({ _id: id, data: defaultValue });
}
