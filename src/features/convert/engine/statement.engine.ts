import type { NetSalesStatement, ValidationIssue } from "@/features/convert/types/convert.types";
import type { NetSalesResult } from "./net-sales.engine";

/**
 * Statement Engine — prepares structured GSTR-1 pre-filing statement
 * combining net sales results, platform contributions, and validation issues.
 */
export function generateStatement(
  netResult: NetSalesResult,
  issues: ValidationIssue[],
  validCount: number,
  errorCount: number,
  reviewCount: number
): NetSalesStatement {
  return {
    totalInvoices: netResult.processedRows.length,
    validInvoices: validCount,
    errorInvoices: errorCount,
    reviewInvoices: reviewCount,

    totalSalesTaxable: netResult.totalSalesTaxable,
    totalSalesCgst: netResult.totalSalesCgst,
    totalSalesSgst: netResult.totalSalesSgst,
    totalSalesIgst: netResult.totalSalesIgst,
    totalSalesCess: netResult.totalSalesCess,
    totalSalesTax: netResult.totalSalesTax,

    totalReturnTaxable: netResult.totalReturnTaxable,
    totalReturnCgst: netResult.totalReturnCgst,
    totalReturnSgst: netResult.totalReturnSgst,
    totalReturnIgst: netResult.totalReturnIgst,
    totalReturnCess: netResult.totalReturnCess,
    totalReturnTax: netResult.totalReturnTax,

    netTaxable: netResult.netTaxable,
    netCgst: netResult.netCgst,
    netSgst: netResult.netSgst,
    netIgst: netResult.netIgst,
    netCess: netResult.netCess,
    netTax: netResult.netTax,
    netGrandTotal: netResult.netGrandTotal,

    b2bCount: netResult.b2bCount,
    b2clCount: netResult.b2clCount,
    b2csCount: netResult.b2csCount,
    cdnrCount: netResult.cdnrCount,
    expCount: netResult.expCount,

    b2bNetTaxable: netResult.b2bNetTaxable,
    b2clNetTaxable: netResult.b2clNetTaxable,
    b2csNetTaxable: netResult.b2csNetTaxable,
    cdnrNetTaxable: netResult.cdnrNetTaxable,
    expNetTaxable: netResult.expNetTaxable,

    platformContributions: netResult.platformContributions,
    issues,
  };
}
