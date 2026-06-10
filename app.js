/**
 * Mhaske Saraf Gold Shop - Interactive Web Experience & Business Booster
 * Logic for fetching Live Gold/Silver Rates, Interactive Catalog, Price Estimator, Cart selection, printable quotations, and WhatsApp inquiries.
 */

// SUPABASE CONNECTION
const SUPABASE_URL = 'https://etttiskikzvgctryaewq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Xlwvm2ZTZjS6eK3rOLdhMw_cTCHcD-a';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- DYNAMIC STATE ---
// Base default rates in case API fetching fails (fallback)
let goldRates = {
    g24k: 7245.00, // Per Gram Base Rate
    g22k: 6641.00,
    silver: 87.50
};

// Selection Quotation list State
let cart = [];

// JEWELRY DATABASE - Now loaded dynamically from Supabase
let jewelryCatalog = [];

// Category mapping helper to ensure database category names map correctly to UI categories
const categoryMapping = {
    'ring': 'rings',
    'rings': 'rings',
    'bangle': 'bangles',
    'bangles': 'bangles',
    'necklace': 'necklaces',
    'necklaces': 'necklaces',
    'mangalsutra': 'mangalsutra'
};

async function loadCatalogFromDB() {
    console.log("Loading jewelry catalog from Supabase database...");
    const { data, error } = await supabaseClient
        .from('products')
        .select('*');

    if (error) {
        throw new Error(`Supabase Database Error: ${error.message}`);
    }

    if (!data) {
        throw new Error("No data returned from products table.");
    }

    // Map DB columns to existing catalog format
    jewelryCatalog = data.map(item => ({
        id: item.id.toString(),
        title: item.name,
        category: categoryMapping[item.category.toLowerCase()] || item.category,
        weight: parseFloat(item.weight) || 10,
        purity: item.purity || '22K Hallmark',
        img: item.image_url,
        desc: item.description || '',
        makingPercent: item.making_percent || 10,
        isLatest: item.is_latest || false
    }));

    console.log(`Loaded ${jewelryCatalog.length} products from Supabase.`);

    // Render the grid after loading
    renderCatalog('all');
}

// --- INITIALIZER ---
async function initializeApp() {
    try {
        console.log("Initializing Mhaske Saraf application...");

        // 1. Load Catalog Grid from Supabase Database
        await loadCatalogFromDB();
        console.log("Catalog loaded and rendered successfully.");

        // 2. Setup Catalog Search & Filter Listeners
        setupCatalogControls();
        console.log("Catalog controls set up successfully.");

        // 3. Setup Price Estimator Calculator
        setupCalculator();
        console.log("Calculator set up successfully.");

        // 4. Setup Navigation, Cart, Drawer & Modal triggers
        setupInterfaceEvents();
        console.log("Interface events set up successfully.");
        
        // Set default date in appointment form to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const aptDateInput = document.getElementById("aptDate");
        if (aptDateInput) {
            aptDateInput.value = tomorrow.toISOString().split('T')[0];
            aptDateInput.min = tomorrow.toISOString().split('T')[0];
        }

        // 5. Fetch live gold rates asynchronously (non-blocking) in background
        fetchLiveRates().then(() => {
            console.log("Live rates fetched and display updated in background.");
            // Re-render catalog after rates are updated so prices reflect live rates
            const activeCategoryBtn = document.querySelector(".filter-btn.active");
            const activeCategory = activeCategoryBtn ? activeCategoryBtn.dataset.category : "all";
            const searchInput = document.getElementById("catalogSearchInput");
            const query = searchInput ? searchInput.value : "";
            renderCatalog(activeCategory, query);
        }).catch(err => {
            console.error("Error updating catalog with live rates:", err);
        });

    } catch (error) {
        console.error("Critical app initialization failed:", error);
        
        // Render a professional, elegant debug banner on the page so the user knows exactly what failed
        const banner = document.createElement("div");
        banner.style.position = "fixed";
        banner.style.bottom = "20px";
        banner.style.right = "20px";
        banner.style.backgroundColor = "#e74c3c";
        banner.style.color = "#ffffff";
        banner.style.padding = "20px";
        banner.style.borderRadius = "8px";
        banner.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5), 0 0 10px rgba(231,76,60,0.5)";
        banner.style.zIndex = "999999";
        banner.style.maxWidth = "400px";
        banner.style.fontFamily = "sans-serif";
        banner.style.fontSize = "13px";
        banner.style.lineHeight = "1.5";
        banner.style.border = "1px solid #c0392b";
        banner.innerHTML = `
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                ⚠️ App Initialization Error
            </div>
            <div><strong>Message:</strong> ${error.message}</div>
            <div style="margin-top: 5px; opacity: 0.8; font-size: 11px; white-space: pre-wrap; max-height: 150px; overflow-y: auto;">${error.stack}</div>
            <button onclick="this.parentElement.remove()" style="margin-top: 10px; background: transparent; border: 1px solid rgba(255,255,255,0.4); color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Dismiss</button>
        `;
        document.body.appendChild(banner);
    }
}

// Robustly check document loading status to ensure initialization runs even if DOMContentLoaded already fired
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    initializeApp();
}

// --- LIVE COMMODITY RATE API CONTROLLER ---
async function fetchLiveRates() {
    console.log("Fetching live precious metal rates...");
    try {
        // Fetch international precious metal rates in USD
        const goldRes = await fetch("https://api.gold-api.com/price/XAU");
        const silverRes = await fetch("https://api.gold-api.com/price/XAG");
        const forexRes = await fetch("https://open.er-api.com/v6/latest/USD");

        if (!goldRes.ok || !forexRes.ok) {
            throw new Error("Failed to fetch live API data, falling back to cached local market rates.");
        }

        const goldData = await goldRes.json();
        const silverData = await silverRes.json();
        const forexData = await forexRes.json();

        // Extract rates
        const xauUsdOunce = goldData.price; // Gold price USD per Ounce
        const xagUsdOunce = silverData.price; // Silver price USD per Ounce
        const usdToInr = forexData.rates ? forexData.rates.INR : null; // USD to INR exchange rate

        // Validate data is not null, undefined, or NaN before doing conversions
        if (!xauUsdOunce || isNaN(xauUsdOunce) || !xagUsdOunce || isNaN(xagUsdOunce) || !usdToInr || isNaN(usdToInr)) {
            throw new Error("Invalid or incomplete rate data fetched from live APIs. Applying local showroom fallbacks.");
        }

        // Convert Ounces to Grams (1 Troy Ounce = 31.1034768 grams)
        const rawGoldGramInr = (xauUsdOunce / 31.1034768) * usdToInr;
        const rawSilverGramInr = (xagUsdOunce / 31.1034768) * usdToInr;

        // Apply standard Indian gold import custom duties, cess, and local premiums (approx 15% / multiplier 1.15)
        const premiumMultiplier = 1.15;

        // Set live rates per gram in INR
        goldRates.g24k = rawGoldGramInr * premiumMultiplier;
        goldRates.g22k = goldRates.g24k * 0.916; // 22K Hallmark is exactly 91.6% purity of 24K
        goldRates.silver = rawSilverGramInr * premiumMultiplier;

        console.log(`Live rates successfully fetched! 24K: ₹${goldRates.g24k.toFixed(2)}/g, 22K: ₹${goldRates.g22k.toFixed(2)}/g, Silver: ₹${goldRates.silver.toFixed(2)}/g`);

    } catch (error) {
        console.warn("Precious Metals API Error:", error.message);
        // Seamless fallback to current solid baseline rates
        goldRates.g24k = 7245.00;
        goldRates.g22k = 6641.00;
        goldRates.silver = 87.50;
    }

    try {
        updateTickerDisplay();
        updateCalculatorRates();
    } catch (err) {
        console.error("Error updating pricing display elements:", err);
    }
}

function updateTickerDisplay() {
    const formatWeightRate = (rate) => "₹" + Math.round(rate * 10).toLocaleString('en-IN');
    const formatSilver = (rate) => "₹" + Math.round(rate * 1000).toLocaleString('en-IN');

    document.getElementById("ticker-24k").textContent = formatWeightRate(goldRates.g24k);
    document.getElementById("ticker-22k").textContent = formatWeightRate(goldRates.g22k);
    document.getElementById("ticker-silver").textContent = formatSilver(goldRates.silver);
}

function updateCalculatorRates() {
    document.getElementById("calc-rate-24k").textContent = "₹" + goldRates.g24k.toFixed(2);
    document.getElementById("calc-rate-22k").textContent = "₹" + goldRates.g22k.toFixed(2);
}

// --- DYNAMIC PRICE COMPUTATION ---
function calculateJewelryPrice(item) {
    const metalRate = item.purity.includes("24K") ? goldRates.g24k : goldRates.g22k;
    const metalCost = item.weight * metalRate;
    const makingCost = metalCost * (item.makingPercent / 100);
    const taxableAmt = metalCost + makingCost;
    
    // Read the manually selected GST value from the globally available selector
    const gstSelector = document.getElementById("calcGst");
    const gstPercent = gstSelector ? parseFloat(gstSelector.value) : 3;
    
    const gstCost = taxableAmt * (gstPercent / 100);
    const finalPrice = taxableAmt + gstCost;
    
    return {
        metalCost,
        makingCost,
        taxableAmt,
        gstCost,
        finalPrice,
        gstPercent
    };
}

// --- CATALOG RENDERING ENGINE ---
function renderCatalog(category = "all", searchQuery = "") {
    const grid = document.getElementById("jewelryGrid");
    grid.innerHTML = "";

    const query = searchQuery.trim().toLowerCase();
    
    const filteredItems = jewelryCatalog.filter(item => {
        const matchesCategory = (category === "all" || item.category === category);
        const matchesSearch = (item.title.toLowerCase().includes(query) || 
                               item.desc.toLowerCase().includes(query) || 
                               item.category.toLowerCase().includes(query));
        return matchesCategory && matchesSearch;
    });

    if (filteredItems.length === 0) {
        grid.innerHTML = `
            <div class="empty-search text-center" style="grid-column: 1/-1; padding: 4rem 1rem; color: var(--color-text-muted);">
                <i class="fa-solid fa-circle-notch fa-spin text-gold" style="font-size: 2.5rem; margin-bottom: 1.5rem;"></i>
                <h4 style="font-family: var(--font-heading); color: var(--color-gold-accent); margin-bottom: 0.5rem;">No Designs Found</h4>
                <p>Try searching for another piece or select a different category.</p>
            </div>
        `;
        return;
    }

    filteredItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "jewelry-card";
        card.innerHTML = `
            <div class="card-img-wrapper">
                ${item.isLatest ? `<span class="card-badge"><i class="fa-solid fa-star"></i> Latest Design</span>` : ""}
                <img src="${item.img}" alt="${item.title}" class="card-img" loading="lazy">
            </div>
            <div class="card-details">
                <span class="card-meta">
                    <span><i class="fa-solid fa-weight-hanging"></i> ${item.weight.toFixed(2)} Grams</span>
                    <span><i class="fa-solid fa-award"></i> ${item.purity}</span>
                </span>
                <h4 class="card-title">${item.title}</h4>
                <p class="card-description" style="font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 5px; margin-bottom: 8px;">${item.desc}</p>
                <div class="card-price-row">
                    <span style="font-size: 0.82rem; font-weight: 600; color: var(--color-gold-accent); display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-circle-info"></i> Daily Rate Inquiry
                    </span>
                    <span style="font-size: 0.72rem; color: var(--color-text-white); opacity: 0.5;">Carat: 22K Hallmark</span>
                </div>
            </div>
            <div class="card-actions">
                <button class="card-btn-inquiry" onclick="triggerWhatsAppInquiry('${item.id}')">
                    <i class="fa-brands fa-whatsapp"></i> Inquire Price
                </button>
                <button class="card-btn-cart" onclick="addToCart('${item.id}')">
                    <i class="fa-solid fa-plus"></i> Add to Quote
                </button>
            </div>
        `;
        // Make the image card click open detail modal
        card.querySelector(".card-img-wrapper").addEventListener("click", () => openProductModal(item.id));
        card.querySelector(".card-title").addEventListener("click", () => openProductModal(item.id));
        grid.appendChild(card);
    });
}

function setupCatalogControls() {
    // Search Listener
    const searchInput = document.getElementById("catalogSearchInput");
    searchInput.addEventListener("input", (e) => {
        const activeCategory = document.querySelector(".filter-btn.active").dataset.category;
        renderCatalog(activeCategory, e.target.value);
    });

    // Filters Listeners
    const filterButtons = document.querySelectorAll(".filter-btn");
    filterButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const category = btn.dataset.category;
            renderCatalog(category, searchInput.value);
        });
    });
}

// --- GOLD PRICE ESTIMATOR ENGINE ---
function setupCalculator() {
    const weightInput = document.getElementById("calcWeight");
    const metalSelect = document.getElementById("calcMetalType");
    const makingInput = document.getElementById("calcMakingCharges");
    const gstSelect = document.getElementById("calcGst");

    const runCalculation = () => {
        const weight = parseFloat(weightInput.value) || 0;
        const metal = metalSelect.value;
        const makingPercent = parseFloat(makingInput.value) || 0;
        const gstPercent = parseFloat(gstSelect.value) || 3;

        let gramRate = 0;
        if (metal === "gold-24k") gramRate = goldRates.g24k;
        else if (metal === "gold-22k") gramRate = goldRates.g22k;
        else if (metal === "silver") gramRate = goldRates.silver;

        const metalCost = weight * gramRate;
        const makingCost = metalCost * (makingPercent / 100);
        const taxableAmt = metalCost + makingCost;
        const gstCost = taxableAmt * (gstPercent / 100);
        const grandTotal = taxableAmt + gstCost;

        // Update Results Panel
        document.getElementById("resMetalCost").textContent = "₹" + Math.round(metalCost).toLocaleString('en-IN');
        document.getElementById("resMakingCost").textContent = "₹" + Math.round(makingCost).toLocaleString('en-IN');
        document.getElementById("resGstCost").textContent = "₹" + Math.round(gstCost).toLocaleString('en-IN');
        document.getElementById("resTotalCost").textContent = "₹" + Math.round(grandTotal).toLocaleString('en-IN');
    };

    weightInput.addEventListener("input", runCalculation);
    makingInput.addEventListener("input", runCalculation);
    metalSelect.addEventListener("change", runCalculation);
    gstSelect.addEventListener("change", runCalculation);

    // Initial calculation
    runCalculation();

    // Estimate WhatsApp inquiry button click
    document.getElementById("calculatorInquiryBtn").addEventListener("click", () => {
        const weight = weightInput.value;
        const metal = metalSelect.options[metalSelect.selectedIndex].text;
        const making = makingInput.value;
        const gst = gstSelect.options[gstSelect.selectedIndex].text;
        const total = document.getElementById("resTotalCost").textContent;

        const message = `Hello Hritik sir, I calculated an estimate on your Mhaske Saraf website for a custom ornament:\n\n- Metal Purity: ${metal}\n- Weight: ${weight} grams\n- Making Charges: ${making}%\n- GST Selected: ${gst}\n- Estimated Showroom Price: ${total}\n\nI would like to discuss this and visit your showroom in Tisgaon. Please guide me.`;
        window.open(`https://wa.me/919960228653?text=${encodeURIComponent(message)}`, "_blank");
    });
}

// --- INTERFACE TRANSITIONS & DRAWER CONTROLLER ---
function setupInterfaceEvents() {
    // Mobile Drawer Hamburger
    const menuToggle = document.getElementById("menuToggleBtn");
    const mobileDrawer = document.getElementById("mobileDrawer");
    const closeDrawer = document.getElementById("closeDrawerBtn");

    menuToggle.addEventListener("click", () => mobileDrawer.classList.add("active"));
    closeDrawer.addEventListener("click", () => mobileDrawer.classList.remove("active"));
    
    // Close Drawer when clicking link
    document.querySelectorAll(".drawer-link").forEach(link => {
        link.addEventListener("click", () => mobileDrawer.classList.remove("active"));
    });

    // Cart Sidebar Toggles
    const cartToggle = document.getElementById("cartToggleBtn");
    const cartDrawer = document.getElementById("cartDrawer");
    const closeCart = document.getElementById("closeCartBtn");
    const cartOverlay = document.getElementById("cartOverlay");

    const openCartDrawer = () => {
        cartDrawer.classList.add("active");
        cartOverlay.classList.add("active");
    };
    
    const closeCartDrawer = () => {
        cartDrawer.classList.remove("active");
        cartOverlay.classList.remove("active");
    };

    cartToggle.addEventListener("click", openCartDrawer);
    closeCart.addEventListener("click", closeCartDrawer);
    cartOverlay.addEventListener("click", closeCartDrawer);
    
    // Cart selection modal close helper
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("close-cart-link")) {
            closeCartDrawer();
        }
    });

    // Product Modal Closes
    document.getElementById("closeProductModalBtn").addEventListener("click", () => {
        document.getElementById("productModal").classList.remove("active");
    });

    // Checkout Modal Closes
    document.getElementById("closeCheckoutModalBtn").addEventListener("click", () => {
        document.getElementById("checkoutModal").classList.remove("active");
    });

    // Cart Actions (Checkout and Clear)
    document.getElementById("clearCartBtn").addEventListener("click", () => {
        cart = [];
        updateCartBadge();
        renderCartItems();
    });

    document.getElementById("checkoutBtn").addEventListener("click", () => {
        closeCartDrawer();
        document.getElementById("checkoutModal").classList.add("active");
    });

    // Customer Invoice Form submission
    document.getElementById("invoiceForm").addEventListener("submit", (e) => {
        e.preventDefault();
        
        // Grab values
        const name = document.getElementById("invCustName").value;
        const phone = document.getElementById("invCustPhone").value;
        const address = document.getElementById("invCustAddress").value;
        const paymentMode = document.getElementById("invPaymentMode").value;

        // Render printable preview
        generatePrintableInvoice(name, phone, address, paymentMode);

        // Transition modals
        document.getElementById("checkoutModal").classList.remove("active");
        document.getElementById("invoicePreviewModal").classList.add("active");
    });

    // Invoice Preview Closing
    document.getElementById("closeInvoicePreviewBtn").addEventListener("click", () => {
        document.getElementById("invoicePreviewModal").classList.remove("active");
    });

    // Print Command Trigger
    document.getElementById("printInvoiceBtn").addEventListener("click", () => {
        window.print();
    });

    // Appointment Booking Submission
    document.getElementById("appointmentForm").addEventListener("submit", (e) => {
        e.preventDefault();
        
        const name = document.getElementById("aptName").value;
        const phone = document.getElementById("aptPhone").value;
        const date = document.getElementById("aptDate").value;
        const category = document.getElementById("aptCategory").options[document.getElementById("aptCategory").selectedIndex].text;

        const dateFormatted = new Date(date).toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const alertMessage = `✨ Showroom Visit Booked! ✨\n\nThank you, ${name}. Your appointment at our Tisgaon showroom has been successfully booked for:\n📅 ${dateFormatted}\n💍 Interested in: ${category}.\n\nOwner Hritik Mhaske is excited to host you. Skip the queue on arrival!`;
        alert(alertMessage);

        // Pre-fill WhatsApp notification
        const waMsg = `Hello Hritik sir, I booked a personal viewing appointment on your Mhaske Saraf website:\n\n- Name: ${name}\n- Contact: ${phone}\n- Preferred Date: ${dateFormatted}\n- Interested Category: ${category}\n\nPlease confirm if this timing is suitable for you. Thank you!`;
        window.open(`https://wa.me/919960228653?text=${encodeURIComponent(waMsg)}`, "_blank");

        document.getElementById("appointmentForm").reset();
    });
}

// --- CART LOGIC ENGINE ---
function addToCart(itemId) {
    const item = jewelryCatalog.find(i => i.id === itemId);
    if (!item) return;

    // Check if already in cart
    if (cart.find(c => c.id === itemId)) {
        alert(`${item.title} is already selected in your quote list!`);
        return;
    }

    cart.push(item);
    updateCartBadge();
    renderCartItems();

    // Trigger visual notification of bag toggle
    const cartToggle = document.getElementById("cartToggleBtn");
    cartToggle.style.transform = "scale(1.2)";
    setTimeout(() => cartToggle.style.transform = "none", 300);
}

function removeFromCart(itemId) {
    cart = cart.filter(c => c.id !== itemId);
    updateCartBadge();
    renderCartItems();
}

function updateCartBadge() {
    const badge = document.getElementById("cartBadgeCount");
    badge.textContent = cart.length;
    badge.style.display = cart.length > 0 ? "flex" : "none";
}

function renderCartItems() {
    const container = document.getElementById("cartDrawerContent");
    const footer = document.getElementById("cartDrawerFooter");
    
    if (cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart-view">
                <i class="fa-solid fa-gem"></i>
                <p>No designs selected yet.</p>
                <a href="#catalog" class="btn btn-secondary close-cart-link">Browse Catalog</a>
            </div>
        `;
        footer.style.display = "none";
        return;
    }

    container.innerHTML = "";
    footer.style.display = "block";

    cart.forEach(item => {
        const costs = calculateJewelryPrice(item);
        const itemRow = document.createElement("div");
        itemRow.className = "cart-item";
        itemRow.innerHTML = `
            <img src="${item.img}" alt="${item.title}" class="cart-item-img">
            <div class="cart-item-details">
                <span class="cart-item-title">${item.title}</span>
                <span class="cart-item-weight">${item.weight.toFixed(2)}g | ${item.purity}</span>
                <span class="cart-item-price">₹${Math.round(costs.finalPrice).toLocaleString('en-IN')}</span>
            </div>
            <button class="remove-cart-item" onclick="removeFromCart('${item.id}')" aria-label="Remove Selection">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        container.appendChild(itemRow);
    });

    updateCartTotals();
}

function updateCartTotals() {
    if (cart.length === 0) return;

    let subMetal = 0;
    let subMaking = 0;
    let subGst = 0;
    let grand = 0;
    let selectedGstPct = 3;

    cart.forEach(item => {
        const costs = calculateJewelryPrice(item);
        subMetal += costs.metalCost;
        subMaking += costs.makingCost;
        subGst += costs.gstCost;
        grand += costs.finalPrice;
        selectedGstPct = costs.gstPercent;
    });

    document.getElementById("cartMetalTotal").textContent = "₹" + Math.round(subMetal).toLocaleString('en-IN');
    document.getElementById("cartMakingTotal").textContent = "₹" + Math.round(subMaking).toLocaleString('en-IN');
    document.getElementById("cartGstTotal").textContent = `₹${Math.round(subGst).toLocaleString('en-IN')} (${selectedGstPct}%)`;
    document.getElementById("cartGrandTotal").textContent = "₹" + Math.round(grand).toLocaleString('en-IN');
}

// --- MODAL ENGINE (PRODUCT DETAIL VIEW) ---
function openProductModal(itemId) {
    const item = jewelryCatalog.find(i => i.id === itemId);
    if (!item) return;

    const costs = calculateJewelryPrice(item);
    const modalGrid = document.getElementById("modalGridContent");

    modalGrid.innerHTML = `
        <div class="modal-img-wrapper">
            <img src="${item.img}" alt="${item.title}">
        </div>
        <div class="modal-info-panel">
            <span class="modal-purity-tag"><i class="fa-solid fa-certificate"></i> BIS Hallmarked Gold</span>
            <h2 class="modal-title">${item.title}</h2>
            <p class="modal-desc">${item.desc}</p>
            
            <div class="modal-spec-grid">
                <div class="spec-item">
                    <span class="label">Product Code</span>
                    <span class="val">#MS-${item.id}</span>
                </div>
                <div class="spec-item">
                    <span class="label">Metal Weight</span>
                    <span class="val">${item.weight.toFixed(2)} Grams</span>
                </div>
                <div class="spec-item">
                    <span class="label">Purity Level</span>
                    <span class="val">${item.purity}</span>
                </div>
                <div class="spec-item">
                    <span class="label">Making Charge</span>
                    <span class="val">${item.makingPercent}%</span>
                </div>
            </div>

            <div class="modal-price-box">
                <span class="price-label">Today's Estimated Value</span>
                <div class="price">₹${Math.round(costs.finalPrice).toLocaleString('en-IN')}</div>
                <span style="font-size: 0.72rem; color: var(--color-text-muted); display: block; margin-top: 5px; line-height: 1.4;">
                    *Calculated based on today's fetched live rate of ₹${Math.round(goldRates.g22k).toLocaleString('en-IN')}/10g (22K). Prices change daily with market rates. Ask Hritik Saraf below to lock final deal.
                </span>
            </div>

            <div class="modal-actions">
                <button class="btn btn-primary" onclick="triggerWhatsAppInquiry('${item.id}')">
                    <i class="fa-brands fa-whatsapp"></i> Inquire Live Price
                </button>
                <button class="btn btn-secondary" onclick="addToCart('${item.id}'); document.getElementById('productModal').classList.remove('active');">
                    <i class="fa-solid fa-cart-arrow-down"></i> Add to Quote List
                </button>
            </div>
        </div>
    `;

    document.getElementById("productModal").classList.add("active");
}

// --- WHATSAPP CONVERSION MESSAGE TEMPLATES ---
function triggerWhatsAppInquiry(itemId) {
    const item = jewelryCatalog.find(i => i.id === itemId);
    if (!item) return;

    const message = `Hello Hritik sir, I am visiting the Mhaske Saraf website and I am interested in inquiring about this design:\n\n- Name: ${item.title}\n- Code: MS-${item.id}\n- Purity: ${item.purity}\n- Weight: ${item.weight.toFixed(2)} grams\n\nPlease let me know its availability and today's final price estimate at your Tisgaon showroom. Thank you!`;
    
    window.open(`https://wa.me/919960228653?text=${encodeURIComponent(message)}`, "_blank");
}

// --- PRINTABLE PRICE QUOTATION GENERATOR ---
function generatePrintableInvoice(custName, custPhone, custAddress, paymentMode) {
    // Generate simulated meta details
    const invId = "MS-QT-" + Math.floor(1000 + Math.random() * 9000);
    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
    const timeStr = currentDate.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    // Populate metadata
    document.getElementById("invMetaId").textContent = invId;
    document.getElementById("invMetaDate").textContent = dateStr;
    document.getElementById("invMetaTime").textContent = timeStr;
    document.getElementById("invDispPaymentMode").textContent = paymentMode;

    // Populate buyer info
    document.getElementById("invCustDispName").textContent = custName;
    document.getElementById("invCustDispPhone").textContent = custPhone;
    document.getElementById("invCustDispAddress").textContent = custAddress;

    // Build Table Content
    const tbody = document.getElementById("invoiceTableBody");
    tbody.innerHTML = "";

    let totalMetalCost = 0;
    let totalMakingCost = 0;
    let totalTaxable = 0;
    let totalGst = 0;
    let totalGrand = 0;
    let selectedGstPct = 3;

    cart.forEach((item, index) => {
        const costs = calculateJewelryPrice(item);
        const hsn = "71131910"; // Jewellery HSN standard code
        
        totalMetalCost += costs.metalCost;
        totalMakingCost += costs.makingCost;
        totalTaxable += costs.taxableAmt;
        totalGst += costs.gstCost;
        totalGrand += costs.finalPrice;
        selectedGstPct = costs.gstPercent;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${item.title}</strong><br><small style="color: #666;">Code: MS-${item.id}</small></td>
            <td>${hsn}</td>
            <td>${item.purity}</td>
            <td>${item.weight.toFixed(2)}g</td>
            <td>₹${Math.round(costs.metalCost).toLocaleString('en-IN')}</td>
            <td>₹${Math.round(costs.makingCost).toLocaleString('en-IN')}</td>
            <td>₹${Math.round(costs.taxableAmt).toLocaleString('en-IN')}</td>
        `;
        tbody.appendChild(row);
    });

    // Populate bottom summary cards
    document.getElementById("invSubtotal").textContent = "₹" + Math.round(totalTaxable).toLocaleString('en-IN');
    document.getElementById("invCgst").textContent = "₹" + Math.round(totalGst / 2).toLocaleString('en-IN');
    document.getElementById("invSgst").textContent = "₹" + Math.round(totalGst / 2).toLocaleString('en-IN');
    document.getElementById("invGrandTotal").textContent = "₹" + Math.round(totalGrand).toLocaleString('en-IN');
}
