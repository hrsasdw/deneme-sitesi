const button = document.getElementById("hello-btn");
const status = document.getElementById("status");

button.addEventListener("click", () => {
  const now = new Date().toLocaleString("tr-TR");
  status.hidden = false;
  status.textContent = `Site çalışıyor. Saat: ${now}`;
});
