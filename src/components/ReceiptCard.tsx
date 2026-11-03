import React from 'react';

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  size?: string;
  lengthShape?: string;
}

interface ReceiptCardProps {
  receiptRef?: React.RefObject<HTMLDivElement | null>;
  customerName: string;
  orderNumber: string;
  orderDate: string;
  whereFrom: string;
  shipByDate: string;
  trackingNumber: string;
  city: string;
  locationState: string;
  items: ReceiptItem[];
  subtotal: number;
  numDiscount: number;
  grandTotal: number;
  shapeLength: string;
  nailSizes: string;
  notes: string;
  formatUSD: (val: number) => string;
  formatDisplayDate: (val: string) => string;
}

export const ReceiptCard: React.FC<ReceiptCardProps> = ({
  receiptRef,
  customerName,
  orderNumber,
  orderDate,
  whereFrom,
  shipByDate,
  trackingNumber,
  city,
  locationState,
  items,
  subtotal,
  numDiscount,
  grandTotal,
  shapeLength,
  nailSizes,
  notes,
  formatUSD,
  formatDisplayDate,
}) => {
  const formattedLocation = [city.trim(), locationState.trim().toUpperCase()].filter(Boolean).join(', ');
  const hasLocation = Boolean(formattedLocation);
  const hasTracking = Boolean(trackingNumber.trim());
  const hasShipBy = Boolean(shipByDate.trim());

  return (
    <div 
      id="receipt-printable-target"
      ref={receiptRef as any}
      className="receipt-print-content receipt-card w-[430px] min-w-[430px] max-w-[430px] bg-white rounded-[18px] p-2.5 sm:p-3 shadow-none relative mx-auto text-[#1c1b1d]"
      style={{
        backgroundColor: '#ffffff',
        color: '#1c1b1d',
        fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div 
        className="rounded-2xl relative bg-white"
        style={{ border: '1.5px solid #e5e5e5', borderRadius: '15px', position: 'relative', backgroundColor: '#ffffff' }}
      >
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, paddingLeft: '12px', paddingRight: '12px', pointerEvents: 'none', zIndex: 0 }}
        >
          <div className="w-full h-full" style={{
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, rgba(185, 165, 215, 0.22) 23px, rgba(185, 165, 215, 0.22) 24px)',
            backgroundPosition: 'top 0px left',
            backgroundSize: '100% 24px'
          }}></div>
        </div>
        <div 
          className="absolute top-0 bottom-0 pointer-events-none z-0"
          style={{ position: 'absolute', top: 0, bottom: 0, left: '30px', width: '1px', backgroundColor: 'rgba(229, 229, 229, 0.85)', pointerEvents: 'none', zIndex: 0 }}
        ></div>
        
        <div className="relative z-10 pt-5 pb-4" style={{ position: 'relative', zIndex: 10 }}>
          <header className="receipt-brand-header">
            <div className="receipt-label text-[11px] font-bold tracking-[0.18em] uppercase text-[#444444] bg-[#F6E7EF] px-2 py-0.5 rounded-md">
              ORDER RECEIPT
            </div>
            <h1 className="receipt-shop-name text-[32px] font-bold font-headline-md tracking-tight text-[#1c1b1d]">
              nails by huntrr
            </h1>
            <div className="receipt-shop-type text-[12px] font-semibold text-[#444444] tracking-wide bg-[#E7F3F4] px-2.5 py-0.5 rounded-md">
              Handmade Press-On Nails
            </div>
            <div className="receipt-etsy-shop text-[11.5px] font-medium text-[#444444] bg-[#F6E7EF] px-2 py-0.5 rounded-md">
              Etsy Shop: NailsByHuntrr
            </div>
          </header>
          
          <div className="h-4.5"></div>
          
          <div className="pl-[36px] sm:pl-[40px] pr-3 sm:pr-3.5">
            <div className="receipt-info-grid">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#444444] bg-[#E7F3F4] px-1.5 py-0.5 rounded-md w-fit mb-1">Customer</span>
                <span className="font-bold text-[#1c1b1d] text-[14px] receipt-field-value">
                  {customerName.trim()}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#444444] bg-[#F6E7EF] px-1.5 py-0.5 rounded-md w-fit mb-1">Order Number</span>
                <span className="font-bold text-[#444444] text-[14px] receipt-field-value">
                  {orderNumber.trim()}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#444444] bg-[#E7F3F4] px-1.5 py-0.5 rounded-md w-fit mb-1">Ordered Date</span>
                <span className="font-bold text-[#1c1b1d] text-[14px] receipt-field-value">
                  {formatDisplayDate(orderDate)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#444444] bg-[#F6E7EF] px-1.5 py-0.5 rounded-md w-fit mb-1">Where From</span>
                <span className="font-bold text-[#444444] text-[14px] receipt-field-value">
                  {whereFrom.trim()}
                </span>
              </div>
            
              {(hasLocation || hasTracking || hasShipBy) && (
                <>
                  <div className="flex flex-col">
                    {hasShipBy ? (
                      <>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#444444] bg-[#E7F3F4] px-1.5 py-0.5 rounded-md w-fit mb-1">Ship By Date</span>
                        <span className="font-semibold text-[#444444] text-[13.5px] receipt-field-value">{formatDisplayDate(shipByDate)}</span>
                      </>
                    ) : hasLocation ? (
                      <>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#444444] bg-[#E7F3F4] px-1.5 py-0.5 rounded-md w-fit mb-1">City / State</span>
                        <span className="font-semibold text-[#1c1b1d] text-[13.5px] receipt-field-value">{formattedLocation}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end">
                    {hasTracking ? (
                      <>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#444444] bg-[#F6E7EF] px-1.5 py-0.5 rounded-md w-fit mb-1">Tracking #</span>
                        <span className="font-semibold text-[#444444] text-[13.5px] tracking-wide receipt-field-value">{trackingNumber.trim()}</span>
                      </>
                    ) : hasShipBy && hasLocation ? (
                      <>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#444444] bg-[#F6E7EF] px-1.5 py-0.5 rounded-md w-fit mb-1">City / State</span>
                        <span className="font-semibold text-[#1c1b1d] text-[13.5px] receipt-field-value">{formattedLocation}</span>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="h-4.5"></div>
          
          <div className="pl-[36px] sm:pl-[40px] pr-3 sm:pr-3.5">
            <div className="receipt-items-grid pb-2 text-[11px] font-bold uppercase tracking-wider">
              <div><span className="text-[#444444] bg-[#F6E7EF] px-1.5 py-0.5 rounded-md">Item Description</span></div>
              <div className="text-center"><span className="text-[#444444] bg-[#E7F3F4] px-1 py-0.5 rounded-md">Qty</span></div>
              <div className="text-right"><span className="text-[#444444] bg-[#F6E7EF] px-1 py-0.5 rounded-md">Price</span></div>
              <div className="text-right"><span className="text-[#444444] bg-[#E7F3F4] px-1.5 py-0.5 rounded-md">Amount</span></div>
            </div>
            <div className="space-y-1.5">
              {items.map((item, idx) => {
                const qty = Number(item.quantity) || 1;
                const prc = Number(item.price) || 0;
                const lineTotal = qty * prc;
                return (
                  <div key={item.id || idx} className="flex flex-col border-b border-transparent">
                    <div className="receipt-items-grid min-h-[26px] items-start">
                      <div className="font-semibold text-[#1c1b1d] text-[13.5px] pr-1.5 receipt-item-description flex items-center leading-tight py-0.5">
                        {item.name.trim() || (items.length === 1 ? 'Handmade Press-On Nails Set' : `Handmade Custom Item #${idx + 1}`)}
                      </div>
                      <div className="text-center font-semibold text-[#444444] text-[13px] flex items-center justify-center py-0.5">{qty}</div>
                      <div className="text-right font-semibold text-[#444444] text-[13px] flex items-center justify-end py-0.5">{formatUSD(prc)}</div>
                      <div className="text-right font-bold text-[#1c1b1d] text-[14px] flex items-center justify-end py-0.5">{formatUSD(lineTotal)}</div>
                    </div>
                    {(item.size?.trim() || item.lengthShape?.trim()) && (
                      <div className="flex flex-col text-[12px] text-[#555555] pl-1.5 pb-0.5">
                        {item.size?.trim() && <div className="flex items-center"><span className="font-bold mr-1 text-[#444444]">SIZE:</span> {item.size.trim()}</div>}
                        {item.lengthShape?.trim() && <div className="flex items-center"><span className="font-bold mr-1 text-[#444444]">LENGTH & SHAPE:</span> {item.lengthShape.trim()}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="h-4.5"></div>
          
          <div className="pl-[36px] sm:pl-[40px] pr-3 sm:pr-3.5 flex justify-end">
            <div className="w-full max-w-[220px] text-[13px] space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[#444444] bg-[#F6E7EF] px-1.5 py-0.5 rounded-md font-bold text-[12px]">Subtotal:</span>
                <span className="font-bold text-[#1c1b1d] text-[14px]">{formatUSD(subtotal)}</span>
              </div>
              {numDiscount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[#444444] bg-[#F6E7EF] px-1.5 py-0.5 rounded-md font-bold text-[12px]">Discount:</span>
                  <span className="font-bold text-[14px]" style={{ color: '#db2777' }}>-{formatUSD(numDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1">
                <span className="text-[13px] font-bold text-[#444444] bg-[#E7F3F4] px-2 py-0.5 rounded-md">Final Total:</span>
                <span className="text-[19px] font-bold text-[#444444] font-headline-md leading-none">{formatUSD(grandTotal)}</span>
              </div>
            </div>
          </div>
          
          {(shapeLength.trim() || nailSizes.trim() || notes.trim()) && (
            <div className="pl-[36px] sm:pl-[40px] pr-3 sm:pr-3.5 pt-2.5 space-y-2">
              {shapeLength.trim() && (
                <div className="flex items-center flex-wrap gap-1.5 text-[13px]">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#444444] bg-[#E7F3F4] px-1.5 py-0.5 rounded-md shrink-0">Shape & Length:</span>
                  <span className="text-[#1c1b1d] font-semibold break-words">{shapeLength.trim()}</span>
                </div>
              )}
              {nailSizes.trim() && (
                <div className="flex items-start flex-wrap gap-1.5 text-[13px]">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#444444] bg-[#F6E7EF] px-1.5 py-0.5 rounded-md shrink-0 mt-0.5">Nail Sizes:</span>
                  <span className="text-[#1c1b1d] font-semibold break-words flex-1 min-w-[140px] leading-tight">{nailSizes.trim()}</span>
                </div>
              )}
              {notes.trim() && (
                <div className="flex items-start flex-wrap gap-1.5 text-[12.5px]">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#444444] bg-[#E7F3F4] px-1.5 py-0.5 rounded-md shrink-0 mt-0.5">Order Notes:</span>
                  <span className="text-[#444444] font-medium break-words flex-1 min-w-[140px] leading-tight">{notes.trim()}</span>
                </div>
              )}
            </div>
          )}
          
          <div className="h-5"></div>
          
          <div className="flex items-end justify-center pb-1.5">
            <p className="text-[13.5px] font-bold text-[#1c1b1d] tracking-tight">Thank you for your support! :3</p>
          </div>
          <div className="flex items-end justify-center gap-2 text-[11.5px] font-semibold pb-1.5">
            <span className="text-[#444444] bg-[#E7F3F4] px-1.5 py-0.5 rounded-md">@nailsbyhuntrr</span>
            <span className="text-[#444444] bg-[#F6E7EF] px-1.5 py-0.5 rounded-md">nailsbyhuntrr.etsy.com</span>
          </div>
          <div className="flex items-end justify-center text-[11.5px] text-[#666666] font-medium">
            <span>on TikTok, Insta, and Etsy</span>
          </div>
        </div>
      </div>
    </div>
  );
};
