/*Scenario:
 A system needs to export reports in PDF, Excel, or CSV. Exported data can come from different services like sales, inventory, or user analytics.
Instruction:
Write classes or modules for the export system.

*/

// ----------------- Interfaces -----------------
interface Exporter {
    export(data: any[]): void;
  }
  
  interface DataService {
    fetchData(): any[];
  }
  
  // ----------------- Exporters -----------------
  class PdfExporter implements Exporter {
    export(data: any[]): void {
      console.log("Exporting data to PDF:", data);
      // Integrate with PDF library (e.g., pdfkit)
    }
  }
  
  class ExcelExporter implements Exporter {
    export(data: any[]): void {
      console.log("Exporting data to Excel:", data);
      // Integrate with exceljs
    }
  }
  
  class CsvExporter implements Exporter {
    export(data: any[]): void {
      console.log("Exporting data to CSV:", data);
      // Integrate with papaparse
    }
  }
  
  // ----------------- Exporter Factory -----------------
  class ExporterFactory {
    static createExporter(format: string): Exporter {
      switch (format.toLowerCase()) {
        case "pdf":
          return new PdfExporter();
        case "excel":
          return new ExcelExporter();
        case "csv":
          return new CsvExporter();
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    }
  }
  
  // ----------------- Data Services -----------------
  class SalesService implements DataService {
    fetchData(): any[] {
      return [
        { orderId: 1, total: 100 },
        { orderId: 2, total: 150 },
      ];
    }
  }
  
  class InventoryService implements DataService {
    fetchData(): any[] {
      return [
        { productId: 1, stock: 50 },
        { productId: 2, stock: 20 },
      ];
    }
  }
  
  class AnalyticsService implements DataService {
    fetchData(): any[] {
      return [
        { userId: 1, sessions: 5 },
        { userId: 2, sessions: 3 },
      ];
    }
  }
  
  // ----------------- DataService Factory -----------------
  class DataServiceFactory {
    static createService(serviceName: string): DataService {
      switch (serviceName.toLowerCase()) {
        case "sales":
          return new SalesService();
        case "inventory":
          return new InventoryService();
        case "analytics":
          return new AnalyticsService();
        default:
          throw new Error(`Unsupported data service: ${serviceName}`);
      }
    }
  }
  
  // ----------------- Export Manager -----------------
  class ExportManager {
    constructor(private service: DataService, private exporter: Exporter) {}
  
    runExport() {
      const data = this.service.fetchData();
      this.exporter.export(data);
    }
  }
  
  // ----------------- Usage Example -----------------
  const serviceName = "sales"; // could come from user input
  const exportFormat = "pdf";  // could come from user input
  
  const service = DataServiceFactory.createService(serviceName);
  const exporter = ExporterFactory.createExporter(exportFormat);
  
  const manager = new ExportManager(service, exporter);
  manager.runExport();
  
  // Another example
  const inventoryService = DataServiceFactory.createService("inventory");
  const csvExporter = ExporterFactory.createExporter("csv");
  
  const manager2 = new ExportManager(inventoryService, csvExporter);
  manager2.runExport();
  