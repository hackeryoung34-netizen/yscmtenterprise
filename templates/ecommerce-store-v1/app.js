const products = [
  {id:1,name:"Sculptural Table Lamp",category:"Home",price:68500,tag:"Bestseller",image:"https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=85"},
  {id:2,name:"Everyday Carry Tote",category:"Accessories",price:24500,tag:"New",image:"https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=85"},
  {id:3,name:"Ceramic Pour-Over Set",category:"Lifestyle",price:32000,tag:"",image:"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=85"},
  {id:4,name:"Linen Cushion Cover",category:"Home",price:18500,tag:"",image:"https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=85"},
  {id:5,name:"Minimal Leather Wallet",category:"Accessories",price:27500,tag:"",image:"https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=85"},
  {id:6,name:"Sunday Ritual Candle",category:"Lifestyle",price:15500,tag:"Small batch",image:"https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=85"},
  {id:7,name:"Oak Side Table",category:"Home",price:112000,tag:"",image:"https://images.unsplash.com/photo-1499933374294-4584851497cc?auto=format&fit=crop&w=800&q=85"},
  {id:8,name:"Travel Flask",category:"Lifestyle",price:22000,tag:"",image:"https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=85"}
];
const money = value => new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(value);
let activeCategory = "All";
let cart = JSON.parse(localStorage.getItem("forma-cart") || "[]");
const grid = document.querySelector("#productGrid");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const drawer = document.querySelector("#cartDrawer");
const toast = document.querySelector("#toast");
let toastTimer;
function renderProducts(){
  const term = searchInput.value.trim().toLowerCase();
  let visible = products.filter(p => (activeCategory==="All" || p.category===activeCategory) && (p.name.toLowerCase().includes(term)||p.category.toLowerCase().includes(term)));
  if(sortSelect.value==="low") visible.sort((a,b)=>a.price-b.price);
  if(sortSelect.value==="high") visible.sort((a,b)=>b.price-a.price);
  grid.innerHTML = visible.length ? visible.map(p=>`
    <article class="product-card">
      <div class="product-image-wrap">
        <img class="product-image" src="${p.image}" alt="${p.name}" loading="lazy">
        ${p.tag ? `<span class="product-tag">${p.tag}</span>` : ""}
        <button class="quick-add" data-add="${p.id}">Add to bag　＋</button>
      </div>
      <div class="product-meta"><div><div class="product-name">${p.name}</div><div class="product-category">${p.category}</div></div><div class="product-price">${money(p.price)}</div></div>
    </article>`).join("") : '<p class="muted">No pieces found. Try another search or category.</p>';
}
function persist(){localStorage.setItem("forma-cart",JSON.stringify(cart));renderCart();}
function addToCart(id){const item=cart.find(x=>x.id===id);if(item)item.qty++;else cart.push({id,qty:1});persist();showToast("Added to your bag");}
function changeQty(id,delta){const item=cart.find(x=>x.id===id);if(!item)return;item.qty+=delta;if(item.qty<=0)cart=cart.filter(x=>x.id!==id);persist();}
function removeItem(id){cart=cart.filter(x=>x.id!==id);persist();}
function renderCart(){
  const count=cart.reduce((sum,item)=>sum+item.qty,0);
  const total=cart.reduce((sum,item)=>sum+products.find(p=>p.id===item.id).price*item.qty,0);
  document.querySelector("#cartCount").textContent=count;
  document.querySelector("#drawerCount").textContent=`(${count})`;
  document.querySelector("#cartSubtotal").textContent=money(total);
  document.querySelector("#cartEmpty").hidden=count>0;
  document.querySelector("#cartFooter").hidden=count===0;
  document.querySelector("#cartItems").innerHTML=cart.map(item=>{const p=products.find(x=>x.id===item.id);return `
    <div class="cart-line"><img src="${p.image}" alt=""><div><h3>${p.name}</h3><p>${money(p.price)}</p><div class="qty-control"><button data-qty="-1" data-id="${p.id}" aria-label="Decrease quantity">−</button><span>${item.qty}</span><button data-qty="1" data-id="${p.id}" aria-label="Increase quantity">+</button></div></div><button class="remove-item" data-remove="${p.id}">Remove</button></div>`;}).join("");
}
function openCart(){document.body.classList.add("cart-open");drawer.setAttribute("aria-hidden","false");}
function closeCart(){document.body.classList.remove("cart-open");drawer.setAttribute("aria-hidden","true");}
function showToast(message){toast.textContent=message;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2200);}
document.querySelector("#categoryFilters").addEventListener("click",e=>{const button=e.target.closest("[data-category]");if(!button)return;activeCategory=button.dataset.category;document.querySelectorAll(".filter-chip").forEach(x=>x.classList.toggle("active",x===button));renderProducts();});
grid.addEventListener("click",e=>{const button=e.target.closest("[data-add]");if(button)addToCart(Number(button.dataset.add));});
searchInput.addEventListener("input",renderProducts);
sortSelect.addEventListener("change",renderProducts);
document.querySelector("#cartToggle").addEventListener("click",openCart);
document.querySelector("#cartClose").addEventListener("click",closeCart);
document.querySelector("#drawerBackdrop").addEventListener("click",closeCart);
document.querySelector("#continueShopping").addEventListener("click",closeCart);
document.querySelector("#cartItems").addEventListener("click",e=>{const qty=e.target.closest("[data-qty]");const remove=e.target.closest("[data-remove]");if(qty)changeQty(Number(qty.dataset.id),Number(qty.dataset.qty));if(remove)removeItem(Number(remove.dataset.remove));});
document.querySelector("#checkoutButton").addEventListener("click",()=>showToast("Demo only — connect Paystack or Stripe to enable checkout."));
document.querySelector("#newsletterForm").addEventListener("submit",e=>{e.preventDefault();document.querySelector("#newsletterMessage").textContent="Thank you — newsletter signup is in demo mode.";e.target.reset();});
document.querySelector("#year").textContent=new Date().getFullYear();
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCart();});
renderProducts();renderCart();