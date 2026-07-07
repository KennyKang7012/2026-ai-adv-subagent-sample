import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ To-Do List 伺服器已啟動： http://localhost:${PORT}`);
});
