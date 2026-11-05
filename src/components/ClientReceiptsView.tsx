import React, { useState, useEffect, useRef } from 'react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Download, 
  Printer, 
  RotateCcw, 
  FileDown, 
  Sparkles, 
  Heart, 
  Calendar, 
  Tag, 
  User, 
  ShoppingBag, 
  FileText, 
  Save, 
  Eye, 
  Search, 
  Check, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkle,
  Truck,
  LayoutGrid,
  Grid,
  Upload,
  Image as ImageIcon,
  Package,
  ArrowLeftRight,
  X,
  Loader2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { toPng, toBlob } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot } from '../lib/workspaceStore';
import { useAuth } from '../lib/AuthContext';
import { SyncStatus } from './SyncStatus';
import { GUEST_SAMPLE_RECEIPTS } from '../lib/guestSampleData';
import { convertPdfToImageDataUrl, createPostagePreview } from '../lib/pdfUtils';
import { ReceiptCard } from './ReceiptCard';

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  size?: string;
  lengthShape?: string;
}

export interface ClientReceipt {
  id: string;
  customerName: string;
  orderNumber: string;
  orderDate: string;
  whereFrom?: string;
  shipByDate?: string;
  city?: string;
  state?: string;
  trackingNumber?: string;
  nailSizes?: string;
  shapeLength?: string;
  items: ReceiptItem[];
  shippingCost?: number;
  discount: number;
  notes?: string;
  postageLabel?: string;
  postageFileName?: string;
  createdAt: string;
  updatedAt: string;
}

function formatUSD(amount: number): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  } catch {
    // fallback
  }
  return dateStr;
}


function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ClientReceiptsView() {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle');
  const [savedReceipts, setSavedReceipts] = useState<ClientReceipt[]>([]);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(getTodayString());
  const [whereFrom, setWhereFrom] = useState('Etsy');
  const [shipByDate, setShipByDate] = useState('');
  const [city, setCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [nailSizes, setNailSizes] = useState('');
  const [shapeLength, setShapeLength] = useState('');
  const [items, setItems] = useState<ReceiptItem[]>([
    { id: '1', name: '', quantity: 1, price: 0 }
  ]);
  const [discount, setDiscount] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');

  // UI States
  const [exportMode, setExportMode] = useState<'receipt' | 'postage' | 'both'>('receipt');
  const [sheetPlacement, setSheetPlacement] = useState<'left' | 'right' | 'both'>('left');
  const [combinedPlacement, setCombinedPlacement] = useState<'receipt-left-postage-right' | 'receipt-right-postage-left'>('receipt-left-postage-right');
  
  // Postage Label States
  const [postageLabel, setPostageLabel] = useState<string>('');
  const [postageFileName, setPostageFileName] = useState<string>('');
  const [isProcessingPostage, setIsProcessingPostage] = useState(false);
  const [postageError, setPostageError] = useState<string | null>(null);
  const [isDraggingPostage, setIsDraggingPostage] = useState(false);
  const postageInputRef = useRef<HTMLInputElement>(null);

  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabMobile, setActiveTabMobile] = useState<'edit' | 'preview' | 'history'>('edit');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);
  const previewSectionRef = useRef<HTMLElement>(null);
  const printPageRef = useRef<HTMLDivElement>(null);
  const receiptExportRef = useRef<HTMLDivElement>(null);
  const postageExportRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to preview section when opened
  useEffect(() => {
    if (showPrintPreview) {
      requestAnimationFrame(() => {
        previewSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  }, [showPrintPreview]);

  // Calculations
  const subtotal = items.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0;
    const prc = Number(item.price) || 0;
    return acc + qty * prc;
  }, 0);

  const numDiscount = typeof discount === 'number' ? discount : 0;
  const grandTotal = Math.max(0, subtotal - numDiscount);

  // Load saved receipts
  useEffect(() => {
    if (!user) return;
    if (user.isAnonymous) {
      setSavedReceipts(GUEST_SAMPLE_RECEIPTS as ClientReceipt[]);
      // Preload first sample into editor
      if (GUEST_SAMPLE_RECEIPTS.length > 0) {
        loadReceiptIntoForm(GUEST_SAMPLE_RECEIPTS[0] as ClientReceipt);
      }
      return;
    }

    const unsub = onSnapshot(
      doc(db, `users/${user.uid}/preferences`, 'clientReceiptsData'),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().receipts) {
          const loaded = docSnap.data().receipts as ClientReceipt[];
          setSavedReceipts(loaded);
          if (!activeReceiptId && loaded.length > 0) {
            loadReceiptIntoForm(loaded[0]);
          }
        } else {
          // If empty in cloud, check localStorage cache
          try {
            const cached = localStorage.getItem(`huntrr_receipts_${user.uid}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              setSavedReceipts(parsed);
              if (parsed.length > 0) loadReceiptIntoForm(parsed[0]);
            }
          } catch (e) {
            console.error('Error reading receipt cache:', e);
          }
        }
      },
      (err) => {
        console.error('Receipts fetch error:', err);
      }
    );

    return () => unsub();
  }, [user]);

  // Persist receipts
  const persistReceipts = async (receiptsList: ClientReceipt[]) => {
    setSavedReceipts(receiptsList);
    if (!user) return;

    // Cache locally
    try {
      localStorage.setItem(`huntrr_receipts_${user.uid}`, JSON.stringify(receiptsList));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    if (user.isAnonymous) {
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 1500);
      return;
    }

    setSyncStatus('saving');
    try {
      const docRef = doc(db, `users/${user.uid}/preferences`, 'clientReceiptsData');
      await setDoc(docRef, { receipts: receiptsList, updatedAt: new Date().toISOString() }, { merge: true });
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      console.error('Error saving receipts:', err);
      setSyncStatus('error');
    }
  };

  const loadReceiptIntoForm = (receipt: ClientReceipt) => {
    setActiveReceiptId(receipt.id);
    setCustomerName(receipt.customerName || '');
    setOrderNumber(receipt.orderNumber || '');
    setOrderDate(receipt.orderDate || getTodayString());
    setWhereFrom(receipt.whereFrom || 'Etsy');
    setShipByDate(receipt.shipByDate || '');
    setCity(receipt.city || '');
    setLocationState(receipt.state || '');
    setTrackingNumber(receipt.trackingNumber || '');
    setNailSizes(receipt.nailSizes || '');
    setShapeLength(receipt.shapeLength || '');
    setItems(receipt.items && receipt.items.length > 0 ? receipt.items : [{ id: '1', name: '', quantity: 1, price: 0 }]);
    setDiscount(receipt.discount || 0);
    setNotes(receipt.notes || '');
    setPostageLabel(receipt.postageLabel || '');
    setPostageFileName(receipt.postageFileName || '');
    if (receipt.postageLabel) {
      setExportMode('both');
    } else {
      setExportMode('receipt');
    }
  };

  const handleSaveReceipt = () => {
    const currentReceipt: ClientReceipt = {
      id: activeReceiptId || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      customerName: customerName.trim() || 'Valued Customer',
      orderNumber: orderNumber.trim() || `#${Math.floor(1000 + Math.random() * 9000)}`,
      orderDate: orderDate || getTodayString(),
      whereFrom: whereFrom.trim() || 'Etsy',
      shipByDate: shipByDate || undefined,
      city: city.trim() || undefined,
      state: locationState.trim() || undefined,
      trackingNumber: trackingNumber.trim() || undefined,
      nailSizes: nailSizes.trim() || undefined,
      shapeLength: shapeLength.trim() || undefined,
      items: items.map(item => ({
        id: item.id,
        name: item.name.trim() || 'Handmade Press-On Nails Set',
        quantity: Math.max(1, Number(item.quantity) || 1),
        price: Number(item.price) || 0,
        size: item.size?.trim() || undefined,
        lengthShape: item.lengthShape?.trim() || undefined
      })),
      discount: numDiscount,
      notes: notes.trim(),
      postageLabel: postageLabel || undefined,
      postageFileName: postageFileName || undefined,
      createdAt: activeReceiptId 
        ? (savedReceipts.find(r => r.id === activeReceiptId)?.createdAt || new Date().toISOString())
        : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setActiveReceiptId(currentReceipt.id);

    let updatedList: ClientReceipt[];
    const exists = savedReceipts.some(r => r.id === currentReceipt.id);
    if (exists) {
      updatedList = savedReceipts.map(r => r.id === currentReceipt.id ? currentReceipt : r);
    } else {
      updatedList = [currentReceipt, ...savedReceipts];
    }

    persistReceipts(updatedList);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  const handleStartNewReceipt = () => {
    setActiveReceiptId(null);
    setCustomerName('');
    setOrderNumber('');
    setOrderDate(getTodayString());
    setWhereFrom('Etsy');
    setShipByDate('');
    setCity('');
    setLocationState('');
    setTrackingNumber('');
    setNailSizes('');
    setShapeLength('');
    setItems([{ id: Date.now().toString(), name: '', quantity: 1, price: 0 }]);
    setDiscount(0);
    setNotes('');
    setPostageLabel('');
    setPostageFileName('');
    setExportMode('receipt');
  };

  const handleClearForm = () => {
    handleStartNewReceipt();
    setShowClearConfirm(false);
  };

  const handleDeleteSavedReceipt = (id: string) => {
    const filtered = savedReceipts.filter(r => r.id !== id);
    persistReceipts(filtered);
    if (activeReceiptId === id) {
      if (filtered.length > 0) {
        loadReceiptIntoForm(filtered[0]);
      } else {
        handleStartNewReceipt();
      }
    }
    setDeleteConfirmId(null);
  };

  // Item Rows Management
  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', quantity: 1, price: 0 }
    ]);
  };

  const handleRemoveItemRow = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof ReceiptItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Postage Label Upload Handler
  const handlePostageUpload = async (file: File) => {
    if (!file) return;
    setIsProcessingPostage(true);
    setPostageError(null);

    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);

      if (!isPdf && !isImage) {
        throw new Error('Please upload a PDF, PNG, or JPG shipping label.');
      }

      const dataUrl = await createPostagePreview(file);

      if (!dataUrl) {
        throw new Error('Could not convert shipping label to preview image.');
      }

      setPostageLabel(dataUrl);
      setPostageFileName(file.name);
      setExportMode('both');
    } catch (err: any) {
      console.error('Error handling postage label upload:', err);
      setPostageError(err?.message || 'Failed to process file. Please try a different PNG, JPG, or PDF.');
    } finally {
      setIsProcessingPostage(false);
    }
  };

  async function waitForElementImages(element: HTMLElement) {
    const images = Array.from(element.querySelectorAll("img"));

    await Promise.all(
      images.map(
        image =>
          image.complete
            ? Promise.resolve()
            : new Promise<void>(resolve => {
                image.onload = () => resolve();
                image.onerror = () => resolve();
              })
      )
    );
  }

  async function captureElement(element: HTMLElement) {
    await waitForElementImages(element);
    await document.fonts.ready;

    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    const html2canvasFn = (html2canvas as any).default || html2canvas;
    return html2canvasFn(element, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
    });
  }

  function fitInside(
    sourceWidth: number,
    sourceHeight: number,
    boxWidth: number,
    boxHeight: number,
    multiplier = 1
  ) {
    const scale =
      Math.min(
        boxWidth / sourceWidth,
        boxHeight / sourceHeight
      ) * multiplier;

    return {
      width: sourceWidth * scale,
      height: sourceHeight * scale,
    };
  }

  async function handleDownloadPrintPdf(exportType: 'both' | 'receipt' | 'postage' = 'both') {
    try {
      setShowPrintPreview(true);

      await new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const receiptElement = receiptExportRef.current;
      const postageElement = postageExportRef.current;

      const hasPostage = Boolean(postageElement && postageLabel);

      if (exportType === 'receipt' && !receiptElement) {
        throw new Error("The current receipt preview was not found.");
      }
      if (exportType === 'postage' && !hasPostage) {
        throw new Error("Please upload a postage label first to export it.");
      }
      if (exportType === 'both' && !receiptElement) {
        throw new Error("The current receipt preview was not found.");
      }

      const capturePromises: Promise<HTMLCanvasElement | null>[] = [];
      
      if (exportType === 'both' || exportType === 'receipt') {
        capturePromises.push(captureElement(receiptElement!));
      } else {
        capturePromises.push(Promise.resolve(null));
      }

      if ((exportType === 'both' || exportType === 'postage') && hasPostage) {
        capturePromises.push(captureElement(postageElement!));
      } else {
        capturePromises.push(Promise.resolve(null));
      }

      const [receiptCanvas, postageCanvas] = await Promise.all(capturePromises);

      const PDFConstructor = (jsPDF as any).jsPDF || jsPDF;
      const pdf = new PDFConstructor({
        orientation: "landscape",
        unit: "pt",
        format: "letter",
        compress: true,
      });

      const pageWidth = 792;
      const pageHeight = 612;
      const halfWidth = 396;
      const padding = 18;

      if (exportType === 'both') {
        const boxWidth = halfWidth - padding * 2;
        const boxHeight = pageHeight - padding * 2;

        if (receiptCanvas) {
          const receiptSize = fitInside(
            receiptCanvas.width,
            receiptCanvas.height,
            boxWidth,
            boxHeight,
            0.96
          );

          const receiptX = padding + (boxWidth - receiptSize.width) / 2;
          const receiptY = padding + (boxHeight - receiptSize.height) / 2;

          pdf.addImage(
            receiptCanvas.toDataURL("image/png"),
            "PNG",
            receiptX,
            receiptY,
            receiptSize.width,
            receiptSize.height
          );
        }

        if (postageCanvas) {
          const postageSize = fitInside(
            postageCanvas.width,
            postageCanvas.height,
            boxWidth,
            boxHeight,
            0.85
          );

          const postageX = halfWidth + padding + (boxWidth - postageSize.width) / 2;
          const postageY = padding + (boxHeight - postageSize.height) / 2;

          pdf.addImage(
            postageCanvas.toDataURL("image/png"),
            "PNG",
            postageX,
            postageY,
            postageSize.width,
            postageSize.height
          );
        }
      } else if (exportType === 'receipt' && receiptCanvas) {
        const boxWidth = pageWidth - padding * 2;
        const boxHeight = pageHeight - padding * 2;
        const receiptSize = fitInside(receiptCanvas.width, receiptCanvas.height, boxWidth, boxHeight, 0.96);
        const receiptX = padding + (boxWidth - receiptSize.width) / 2;
        const receiptY = padding + (boxHeight - receiptSize.height) / 2;
        pdf.addImage(receiptCanvas.toDataURL("image/png"), "PNG", receiptX, receiptY, receiptSize.width, receiptSize.height);
      } else if (exportType === 'postage' && postageCanvas) {
        const boxWidth = pageWidth - padding * 2;
        const boxHeight = pageHeight - padding * 2;
        const postageSize = fitInside(postageCanvas.width, postageCanvas.height, boxWidth, boxHeight, 0.96);
        const postageX = padding + (boxWidth - postageSize.width) / 2;
        const postageY = padding + (boxHeight - postageSize.height) / 2;
        pdf.addImage(postageCanvas.toDataURL("image/png"), "PNG", postageX, postageY, postageSize.width, postageSize.height);
      }

      const safeName =
        customerName
          ?.trim()
          .replace(/[^a-z0-9]+/gi, "_") || "Customer";
      
      let fileName = `NailsByHuntrr_Print_${safeName}.pdf`;
      if (exportType === 'receipt') fileName = `NailsByHuntrr_Receipt_${safeName}.pdf`;
      if (exportType === 'postage') fileName = `NailsByHuntrr_Postage_${safeName}.pdf`;

      pdf.save(fileName);
    } catch (error) {
      console.error("PDF export failed:", error);

      alert(
        error instanceof Error
          ? error.message
          : "The PDF could not be created."
      );
    }
  }

  const handlePrintSavedReceipt = async (rec: ClientReceipt, exportType: 'both' | 'receipt' | 'postage' = 'both') => {
    loadReceiptIntoForm(rec);
    await new Promise(res => setTimeout(res, 250));
    await handleDownloadPrintPdf(exportType);
  };

  const filteredReceipts = savedReceipts.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.customerName?.toLowerCase().includes(q) ||
      r.orderNumber?.toLowerCase().includes(q) ||
      r.whereFrom?.toLowerCase().includes(q) ||
      r.shapeLength?.toLowerCase().includes(q) ||
      r.nailSizes?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 md:overflow-y-auto flex flex-col px-3 sm:px-6 md:px-margin-desktop pb-safe-nav pt-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-pink-100 flex items-center justify-center shadow-xs border border-gray-600">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[24px] sm:text-[28px] font-bold font-headline-md text-[#1c1b1d] tracking-tight leading-tight flex items-center gap-2">
                Client Receipts
                <span className="text-[14px] font-bold font-sans px-3 py-1 rounded-full bg-[#f5f5f5] text-[#555555] border border-gray-200 hidden sm:inline-flex items-center gap-1">
                  <Sparkle className="w-4 h-4 text-gray-400" /> NailsByHuntrr
                </span>
              </h1>
              <p className="text-[13px] sm:text-[14px] text-[#666666] font-medium">
                Create cute, ink-friendly Etsy order receipts & export to PDF or PNG
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <SyncStatus status={syncStatus} />
          <button
            onClick={handleStartNewReceipt}
            className="px-4 py-2 bg-white hover:bg-pink-50/50 text-[#6f5482] border border-pink-200 rounded-full text-[13px] font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            title="Start a new blank receipt"
          >
            <Plus className="w-4 h-4 text-[#444444]" />
            <span>New Receipt</span>
          </button>
          <button
            onClick={handleSaveReceipt}
            className="px-4 py-2 bg-pink-100 hover:bg-pink-100 text-white rounded-full text-[13px] font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            title="Save receipt to app history"
          >
            <Save className="w-4 h-4" />
            <span>{saveSuccessNotice ? 'Saved!' : 'Save Receipt'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="receipt-form w-full flex flex-col gap-6 min-h-0">
        {/* Form Card */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-pink-100 shadow-[0_4px_20px_rgba(111,87,105,0.04)]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-pink-50">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-100/90"></span>
                <h2 className="text-[16px] sm:text-[18px] font-bold text-[#1c1b1d]">
                  {activeReceiptId ? 'Edit Order Details' : 'New Client Receipt'}
                </h2>
              </div>
              
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="text-[12px] font-semibold text-[#888888] hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-full hover:bg-red-50"
                title="Reset form"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Form</span>
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Order Info Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                    Customer Name or Etsy User <span className="text-pink-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#444444] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Chloe M. (@chloenails)"
                      className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all placeholder:text-[#999999]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                    Order Number <span className="text-pink-500">*</span>
                  </label>
                  <div className="relative">
                    <Tag className="w-4 h-4 text-[#444444] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="e.g. #ETSY-29481"
                      className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all placeholder:text-[#999999]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Order Date */}
                <div>
                  <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                    Order Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[#444444] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all"
                    />
                  </div>
                </div>

                {/* Where From */}
                <div>
                  <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                    Where From (Order Source)
                  </label>
                  <div className="relative">
                    <ShoppingBag className="w-4 h-4 text-[#444444] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      list="where-from-list"
                      value={whereFrom}
                      onChange={(e) => setWhereFrom(e.target.value)}
                      placeholder="e.g. Etsy, TikTok, Instagram"
                      className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all placeholder:text-[#999999]"
                    />
                    <datalist id="where-from-list">
                      <option value="Etsy" />
                      <option value="TikTok" />
                      <option value="Instagram" />
                      <option value="Website" />
                      <option value="Direct / DM" />
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ship By Date */}
                <div>
                  <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                    Ship By Date <span className="font-normal text-[#888888]">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-[#444444] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={shipByDate}
                      onChange={(e) => setShipByDate(e.target.value)}
                      className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all"
                    />
                  </div>
                </div>

                {/* Tracking Number */}
                <div>
                  <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                    Tracking # <span className="font-normal text-[#888888]">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Truck className="w-4 h-4 text-[#444444] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. 1Z9999W9999"
                      className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl pl-10 pr-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all placeholder:text-[#999999]"
                    />
                  </div>
                </div>
              </div>

              {/* City & State */}
              <div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                      City <span className="font-normal text-[#888888]">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Des Moines"
                      className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all placeholder:text-[#999999]"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      value={locationState}
                      onChange={(e) => setLocationState(e.target.value)}
                      placeholder="IA"
                      maxLength={2}
                      className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all placeholder:text-[#999999] uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Products Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[13px] font-bold text-[#444444] flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-[#444444]" />
                    Products / Items ({items.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-[12px] font-bold text-[#7e5265] hover:text-[#563c68] bg-[#f5f5f5] hover:bg-gray-100/70 px-3 py-1 rounded-full border border-pink-200/60 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Row</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {items.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="p-3 bg-[#f5f5f5] border border-purple-100 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center transition-all hover:border-purple-200"
                    >
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                          placeholder={`Item #${index + 1} Name (e.g. Pastel Almond Press-On Nails)`}
                          className="w-full bg-white border border-purple-100/80 focus:border-[#6f5482] rounded-xl px-3 py-2 text-[13px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all placeholder:text-[#999999]"
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-20">
                          <label className="text-[10px] font-bold text-[#666666] block sm:hidden">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity || ''}
                            onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            placeholder="Qty"
                            className="w-full bg-white border border-purple-100/80 focus:border-[#6f5482] rounded-xl px-2.5 py-2 text-[13px] text-center text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
                            title="Quantity"
                          />
                        </div>

                        <div className="w-28">
                          <label className="text-[10px] font-bold text-[#666666] block sm:hidden">Price ($)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#888888]">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.price === 0 ? '' : item.price}
                              onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full bg-white border border-purple-100/80 focus:border-[#6f5482] rounded-xl pl-6 pr-2.5 py-2 text-[13px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-purple-200/50 transition-all"
                              title="Unit Price"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(item.id)}
                          disabled={items.length <= 1}
                          className="p-2 text-[#999999] hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer shrink-0"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nail Details: Shape & Length + Nail Sizes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* Shape & Length */}
                <div>
                  <label className="block text-[13px] font-bold text-[#444444] mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#7e5265]" />
                    Shape & Length <span className="font-normal text-[#888888]">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    list="shape-length-suggestions"
                    value={shapeLength}
                    onChange={(e) => setShapeLength(e.target.value)}
                    placeholder="e.g. Almond • Medium"
                    className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all placeholder:text-[#999999]"
                  />
                  <datalist id="shape-length-suggestions">
                    <option value="Almond • Short" />
                    <option value="Almond • Medium" />
                    <option value="Almond • Long" />
                    <option value="Coffin • Short" />
                    <option value="Coffin • Medium" />
                    <option value="Coffin • Long" />
                    <option value="Square • Short" />
                    <option value="Square • Medium" />
                    <option value="Square • Long" />
                    <option value="Stiletto • Medium" />
                    <option value="Stiletto • Long" />
                    <option value="Oval • Short" />
                    <option value="Oval • Medium" />
                    <option value="Round • Short" />
                    <option value="Round • Medium" />
                  </datalist>
                </div>

                {/* Nail Sizes */}
                <div>
                  <label className="block text-[13px] font-bold text-[#444444] mb-1.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#7e5265]" />
                    Nail Sizes <span className="font-normal text-[#888888]">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={nailSizes}
                    onChange={(e) => setNailSizes(e.target.value)}
                    placeholder="e.g. Thumb 15mm, Index 12mm..."
                    className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl px-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all placeholder:text-[#999999]"
                  />
                </div>
              </div>

              {/* Discount */}
              <div className="pt-1">
                <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                  Discount ($) <span className="text-xs font-normal text-[#888888]">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#888888]">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount === 0 ? '' : discount}
                    onChange={(e) => setDiscount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl pl-8 pr-3.5 py-2.5 text-[14px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all"
                  />
                </div>
              </div>

              {/* Order Notes */}
              <div>
                <label className="block text-[13px] font-bold text-[#444444] mb-1.5">
                  Order Notes <span className="text-xs font-normal text-[#888888]">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Application instructions included ✨ / Thank you for supporting small business!"
                  className="w-full bg-[#f5f5f5] border border-pink-100 focus:border-[#7e5265] rounded-xl px-3.5 py-2.5 text-[13px] text-[#1c1b1d] focus:outline-none focus:ring-2 focus:ring-pink-200/50 transition-all placeholder:text-[#999999]"
                />
              </div>

              {/* Add Postage / Shipping Label (Optional) */}
              <div className="pt-2 border-t border-pink-100/60">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-bold text-[#444444] flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-[#7e5265]" />
                    <span>Postage / Shipping Label</span>
                    <span className="text-[11px] font-normal text-[#888888] bg-gray-100 px-2 py-0.5 rounded-full">
                      Optional • PDF, PNG, JPG
                    </span>
                  </label>
                  {postageLabel && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" /> Attached
                    </span>
                  )}
                </div>

                <p className="text-[12px] text-[#666666] mb-2.5 leading-snug">
                  Upload the actual USPS, Etsy, or PirateShip label you purchased for this order to print side-by-side on 2-sticker half-sheet paper.
                </p>

                {/* Hidden File Input */}
                <input
                  ref={postageInputRef}
                  type="file"
                  accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePostageUpload(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                {/* Upload Zone or Preview Card */}
                {!postageLabel ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingPostage(true); }}
                    onDragLeave={() => setIsDraggingPostage(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingPostage(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handlePostageUpload(file);
                    }}
                    onClick={() => postageInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      isDraggingPostage
                        ? 'border-[#7e5265] bg-pink-50/60'
                        : 'border-pink-200/90 bg-[#fdfbfd] hover:bg-pink-50/30 hover:border-pink-300'
                    }`}
                  >
                    {isProcessingPostage ? (
                      <div className="flex flex-col items-center justify-center py-2 gap-2 text-[#7e5265]">
                        <Loader2 className="w-6 h-6 animate-spin text-[#7e5265]" />
                        <span className="text-[13px] font-semibold">Processing & rendering shipping label...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-1 gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center text-[#7e5265]">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[13px] font-bold text-[#7e5265]">Click to upload</span>
                          <span className="text-[13px] text-[#666666]"> or drag and drop</span>
                        </div>
                        <span className="text-[11px] text-[#888888]">PDF, PNG, JPG, or WEBP (Standard 4×6″ or 8.5×11″)</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-white border border-pink-200 rounded-2xl flex items-center gap-3 shadow-2xs">
                    <div className="w-14 h-16 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                      <img 
                        src={postageLabel} 
                        alt="Postage Thumbnail" 
                        className="w-full h-full object-contain p-0.5" 
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[13px] text-[#1c1b1d] truncate">
                          {postageFileName || 'Postage Label Attached'}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[#666666] mt-0.5">
                        Ready for 11″ × 8.5″ 2-sticker half-sheet printing
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => postageInputRef.current?.click()}
                        disabled={isProcessingPostage}
                        className="px-2.5 py-1.5 text-[12px] font-bold text-[#7e5265] bg-pink-50 hover:bg-pink-100 rounded-xl transition-colors cursor-pointer"
                        title="Replace label with a different file"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPostageLabel('');
                          setPostageFileName('');
                          setExportMode('receipt');
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Remove attached postage label"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {postageError && (
                  <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-600 flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{postageError}</span>
                  </div>
                )}
              </div>

              {/* Summary Stats Banner */}
              <div className="mt-4 p-4 rounded-2xl bg-[#f5f5f5] border border-pink-100 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#7e5265]">
                    Calculated Summary
                  </div>
                  <div className="text-[13px] text-[#666666]">
                    Subtotal: <span className="font-semibold text-[#111111]">{formatUSD(subtotal)}</span>
                    {numDiscount > 0 && <span> • Discount: -{formatUSD(numDiscount)}</span>}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#888888]">Final Total</div>
                  <div className="text-[20px] font-bold text-[#7e5265]">{formatUSD(grandTotal)}</div>
                </div>
              </div>

              {/* Action Bar Immediately Under Calculated Summary */}
              <div className="receipt-actions">
                <button
                  id="btn-save-receipt"
                  type="button"
                  onClick={handleSaveReceipt}
                  className="px-5 py-2.5 rounded-xl bg-pink-100 hover:bg-pink-100 text-white text-[13.5px] font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Receipt</span>
                </button>

                <button
                  id="btn-view-print-page"
                  type="button"
                  onClick={() => setShowPrintPreview(prev => !prev)}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-[#1c1b1d] border border-gray-300 text-[13.5px] font-bold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Eye className="w-4 h-4 text-[#7e5265]" />
                  <span>{showPrintPreview ? 'Close Previews' : 'Preview Items'}</span>
                </button>

                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => handleDownloadPrintPdf('both')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-pink-100 hover:bg-pink-100 text-white text-[13.5px] font-bold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Save / Print Receipt + Postage</span>
                  </button>
                  {/* Dropdown for individual saves */}
                  <div className="absolute top-full right-0 mt-2 w-[220px] bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleDownloadPrintPdf('receipt')}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 text-[13px] font-semibold text-[#1c1b1d] flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4 text-gray-500" /> Save Receipt Only
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPrintPdf('postage')}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 text-[13px] font-semibold text-[#1c1b1d] flex items-center gap-2 border-t border-gray-100"
                    >
                      <Package className="w-4 h-4 text-gray-500" /> Save Postage Only
                    </button>
                  </div>
                </div>
              </div>

              {/* Clear confirmation toast / banner */}
              {saveSuccessNotice && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[13px] font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200 shadow-xs">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Receipt saved successfully to recent receipts and synchronized!</span>
                </div>
              )}
            </div>
          </div>

          {/* Separate Print Preview Section */}
          {showPrintPreview && (
            <section ref={previewSectionRef} className="print-preview-section space-y-6">
              {/* Header with Close Preview */}
              <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-xs flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-[14px] font-bold text-[#1c1b1d]">
                  <div className="w-8 h-8 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-[#7e5265]">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[15px] text-[#1c1b1d]">Item Previews</h3>
                    <p className="text-[12px] text-[#666666] font-normal">
                      Preview the receipt and postage label before exporting.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrintPreview(false)}
                  className="px-3.5 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12.5px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Previews</span>
                </button>
              </div>

              {/* Receipt Preview Card */}
              <div className="bg-white rounded-2xl p-5 sm:p-8 border border-pink-100 shadow-sm flex flex-col items-center">
                <h4 className="font-bold text-[14px] text-[#1c1b1d] mb-4 text-center w-full border-b border-pink-50 pb-3">Customer Receipt</h4>
                <div ref={receiptExportRef} className="receipt-export-content flex justify-center w-full">
                  <ReceiptCard
                    receiptRef={receiptRef}
                    customerName={customerName}
                    orderNumber={orderNumber}
                    orderDate={orderDate}
                    whereFrom={whereFrom}
                    shipByDate={shipByDate}
                    trackingNumber={trackingNumber}
                    city={city}
                    locationState={locationState}
                    items={items}
                    subtotal={subtotal}
                    numDiscount={numDiscount}
                    grandTotal={grandTotal}
                    shapeLength={shapeLength}
                    nailSizes={nailSizes}
                    notes={notes}
                    formatUSD={formatUSD}
                    formatDisplayDate={formatDisplayDate}
                  />
                </div>
              </div>

              {/* Postage Preview Card */}
              <div className="bg-white rounded-2xl p-5 sm:p-8 border border-pink-100 shadow-sm flex flex-col items-center">
                <h4 className="font-bold text-[14px] text-[#1c1b1d] mb-4 text-center w-full border-b border-pink-50 pb-3">Postage Label</h4>
                <div ref={postageExportRef} className="postage-export-content flex justify-center w-full max-w-[600px]">
                  {postageLabel ? (
                    <img 
                      src={postageLabel} 
                      alt="Postage label preview" 
                      className="w-full h-auto object-contain max-h-[500px] border border-gray-200 rounded-xl shadow-xs"
                    />
                  ) : isProcessingPostage ? (
                    <div className="flex flex-col items-center justify-center p-10 bg-gray-50 border border-dashed border-gray-300 rounded-2xl text-gray-500 w-full">
                      <Loader2 className="w-8 h-8 animate-spin text-[#7e5265] mb-2" />
                      <p className="text-[13px] font-medium">Preparing postage label…</p>
                    </div>
                  ) : (
                    <div 
                      data-hide-on-export="true"
                      onClick={() => postageInputRef.current?.click()}
                      className="w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center p-10 text-center text-gray-400 hover:border-[#7e5265] hover:text-[#7e5265] cursor-pointer transition-colors"
                    >
                      <Package className="w-10 h-10 mb-2 opacity-60" />
                      <p className="text-[14px] font-bold">No postage label attached</p>
                      <p className="text-[12px] mt-1 text-gray-500">
                        Click to attach a PDF or image shipping label
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Saved History List */}
          <div className="saved-receipts bg-white rounded-3xl p-5 sm:p-6 border border-pink-100 shadow-[0_4px_20px_rgba(111,87,105,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[#1c1b1d] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#444444]" />
                Saved Recent Receipts ({savedReceipts.length})
              </h3>
              
              {savedReceipts.length > 3 && (
                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search history..."
                    className="w-full bg-[#f5f5f5] border border-pink-100 rounded-lg pl-7 pr-2 py-1 text-[12px] text-[#111111] focus:outline-none"
                  />
                </div>
              )}
            </div>

            {savedReceipts.length === 0 ? (
              <div className="text-center py-6 text-[13px] text-gray-400 italic">
                No saved receipts yet. Fill the form and click "Save Receipt"!
              </div>
            ) : filteredReceipts.length === 0 ? (
              <div className="text-center py-4 text-[13px] text-gray-400 italic">
                No receipts match your search.
              </div>
            ) : (
              <div className="divide-y divide-pink-50 max-h-[300px] overflow-y-auto pr-1">
                {filteredReceipts.map((rec) => {
                  const isActive = activeReceiptId === rec.id;
                  const recTotal = (rec.items || []).reduce((sum, i) => sum + (i.quantity || 0) * (i.price || 0), 0) - (rec.discount || 0);

                  return (
                    <div
                      key={rec.id}
                      className={`py-4 px-3 sm:px-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between transition-all gap-4 ${
                        isActive ? 'bg-gray-50 border border-pink-200/80' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          loadReceiptIntoForm(rec);
                          setShowPrintPreview(true);
                        }}
                        className="flex-1 text-left min-w-0 pr-2 cursor-pointer block"
                      >
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-bold text-[15px] text-[#1c1b1d] truncate block max-w-full">
                            {rec.customerName || 'Unnamed Customer'}
                          </span>
                          {rec.orderNumber && (
                            <span className="text-[11px] font-semibold text-pink-600 bg-[#f5f5f5] px-2 py-0.5 rounded-full shrink-0">
                              {rec.orderNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-[#777777] flex items-center gap-2 mt-0.5 flex-wrap">
                          <span>{rec.orderDate}</span>
                          <span>•</span>
                          <span className="font-semibold text-[#6f5482]">{formatUSD(recTotal)}</span>
                          {rec.trackingNumber?.trim() && (
                            <>
                              <span>•</span>
                              <span className="text-gray-500">Track: {rec.trackingNumber}</span>
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2.5">
                          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#1c1b1d] bg-white border border-gray-200 shadow-2xs rounded-lg px-2 py-1 w-fit">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Receipt</span>
                          </div>
                          {rec.postageLabel ? (
                            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#1c1b1d] bg-white border border-gray-200 shadow-2xs rounded-lg px-2 py-1 w-fit">
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Postage</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 w-fit">
                              <X className="w-3.5 h-3.5 text-gray-300" />
                              <span>No Postage</span>
                            </div>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-0 border-gray-100 pt-3 sm:pt-0 w-full sm:w-auto">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              loadReceiptIntoForm(rec);
                              setShowPrintPreview(true);
                            }}
                            className="p-2 text-gray-600 hover:text-[#7e5265] hover:bg-pink-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-[13px] font-semibold bg-gray-50 sm:bg-transparent"
                            title="Open and view print preview"
                          >
                            <Eye className="w-4 h-4 text-[#7e5265]" />
                            <span className="inline sm:hidden lg:inline">View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              loadReceiptIntoForm(rec);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-2 text-gray-600 hover:text-[#7e5265] hover:bg-pink-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-[13px] font-semibold bg-gray-50 sm:bg-transparent"
                            title="Edit receipt in form"
                          >
                            <FileText className="w-4 h-4 text-gray-500" />
                            <span className="inline sm:hidden lg:inline">Edit</span>
                          </button>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <div className="relative group/dropdown">
                            <button
                              type="button"
                              onClick={() => handlePrintSavedReceipt(rec, 'both')}
                              className="p-2 text-gray-600 hover:text-[#444444] hover:bg-gray-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-[13px] font-semibold bg-gray-50 sm:bg-transparent"
                              title="Download PDF (Both)"
                            >
                              <FileDown className="w-4 h-4 text-[#444444]" />
                              <span className="inline sm:hidden lg:inline">Download</span>
                            </button>
                            <div className="absolute bottom-full right-0 mb-1 w-[180px] bg-white border border-gray-200 rounded-xl shadow-lg opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all z-50 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => handlePrintSavedReceipt(rec, 'receipt')}
                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-[12px] font-semibold text-[#1c1b1d] flex items-center gap-2"
                              >
                                <FileText className="w-3.5 h-3.5 text-gray-500" /> Receipt Only
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintSavedReceipt(rec, 'postage')}
                                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-[12px] font-semibold text-[#1c1b1d] flex items-center gap-2 border-t border-gray-100"
                              >
                                <Package className="w-3.5 h-3.5 text-gray-500" /> Postage Only
                              </button>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(rec.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer ml-1 bg-gray-50 sm:bg-transparent"
                            title="Delete saved receipt"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div role="dialog" aria-modal="true" aria-label="ClientReceipts dialog" tabIndex={-1} className="fixed inset-0 z-50 bg-pink-100/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl border border-pink-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-[18px] font-bold text-center text-[#1c1b1d] mb-1">Clear Receipt Form?</h3>
            <p className="text-[13px] text-center text-[#666666] mb-5">
              This will reset the form back to a blank template. Saved receipts in your history will remain untouched.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[#444444] text-[13px] font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearForm}
                className="flex-1 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-[13px] font-bold transition-colors shadow-xs cursor-pointer"
              >
                Yes, Clear Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Saved Receipt Confirmation Modal */}
      {deleteConfirmId && (
        <div role="dialog" aria-modal="true" aria-label="ClientReceipts dialog" tabIndex={-1} className="fixed inset-0 z-50 bg-pink-100/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl border border-pink-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-[18px] font-bold text-center text-[#1c1b1d] mb-1">Delete Saved Receipt?</h3>
            <p className="text-[13px] text-center text-[#666666] mb-5">
              Are you sure you want to permanently delete this receipt from your saved history?
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-[#444444] text-[13px] font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSavedReceipt(deleteConfirmId)}
                className="flex-1 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-[13px] font-bold transition-colors shadow-xs cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
