export const exportToCSV = (filename, rows) => {
  // Convert rows to CSV format, handling commas inside data securely
  const csvContent = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  
  // Create a Blob containing the CSV data
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  // Create a hidden link and trigger the download
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  
  link.click(); // Trigger download
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};