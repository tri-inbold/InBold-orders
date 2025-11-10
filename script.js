// Import các hàm cần thiết từ Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- KHỞI TẠO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyCDrCaGUyr9xLkT-xOqzFd9grp6tN2u7Zo",
        authDomain: "hp-orders.firebaseapp.com",
        projectId: "hp-orders",
        storageBucket: "hp-orders.appspot.com",
        messagingSenderId: "616722831059",
        appId: "1:616722831059:web:9d19988d87397e7c13e626"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    // --- CÁC PHẦN TỬ UI ---
    const mainContent = document.getElementById('main-content');
    const tabBar = document.getElementById('tab-bar');
    const loader = document.getElementById('loader');
    const userProfileDiv = document.getElementById('user-profile');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    
    // --- TRẠNG THÁI ỨNG DỤNG ---
    const state = {
        currentUser: null,
        staffProfile: {},
        language: 'vi',
        currentTab: 'today',
        thisWeekString: getWeekString(new Date()),
        nextWeekString: getWeekString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        orderSelection: { mon: null, tue: null, wed: null, thu: null, fri: null },
    };

    const translations = {
        vi: { /* ... Thêm các bản dịch từ file cũ của bạn ... */ today: "Hôm Nay", menu: "Thực Đơn", order: "Đặt Món", settings: "Cài đặt" },
        en: { /* ... Thêm các bản dịch từ file cũ của bạn ... */ today: "Today", menu: "Menu", order: "Order", settings: "Settings" }
    };
    
    // --- CÁC HÀM HELPER ---
    function getWeekString(date) { /* ... */ return `${date.getFullYear()}_${Math.ceil((((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(date.getFullYear(), 0, 1)) / 86400000) + new Date(date.getFullYear(), 0, 1).getDay() + 1) / 7)}`; }
    const getDayKey = () => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
    const showLoader = () => loader.classList.remove('hidden');
    const hideLoader = () => loader.classList.add('hidden');
    const t = (key) => (translations[state.language] && translations[state.language][key]) || key;
    const parseDish = (dishString) => { /* ... */ return dishString ? (dishString.split('|')[state.language === 'en' && dishString.split('|').length > 1 ? 1 : 0] || '').trim() : ''; };


    // --- HÀM RENDER CHÍNH ---
    async function render() {
        showLoader();
        // Cập nhật ngôn ngữ trên UI tĩnh
        document.querySelectorAll('[data-lang-key]').forEach(el => {
            el.innerText = t(el.dataset.langKey);
        });

        switch (state.currentTab) {
            case 'today': await renderToday(); break;
            case 'menu': await renderMenu(); break;
            case 'order': await renderOrder(); break;
        }
        hideLoader();
    }

    // --- RENDER CÁC TAB ---
    async function renderToday() {
        const dayKey = getDayKey();
        if (dayKey === 'sun' || dayKey === 'sat') {
            mainContent.innerHTML = `<div class="card glass"><h2>Hôm nay không phục vụ bữa ăn.</h2></div>`;
            return;
        }

        const docRef = doc(db, state.thisWeekString, dayKey);
        const docSnap = await getDoc(docRef);
        let content = `<div class="card glass"><h2>Món ăn hôm nay</h2>`;

        if (docSnap.exists()) {
            const dayData = docSnap.data();
            const userOrder = dayData[state.currentUser.displayName];
            if (userOrder && userOrder.food) {
                const isEaten = userOrder.status === 'eat';
                content += `<div class="dish-name">${parseDish(userOrder.food)}</div>
                            <button id="eat-button" class="btn-primary" ${isEaten ? 'disabled' : ''}>
                                ${isEaten ? 'Đã xác nhận' : 'Xác nhận đã ăn'}
                            </button>`;
            } else {
                content += `<p>Bạn chưa đặt món cho hôm nay.</p>`;
            }
        } else {
            content += `<p>Chưa có thực đơn cho ngày hôm nay.</p>`;
        }
        mainContent.innerHTML = content + `</div>`;
    }

    async function renderMenu() {
        const dayKey = getDayKey();
        const docRef = doc(db, state.thisWeekString, dayKey);
        const docSnap = await getDoc(docRef);

        let content = `<div class="card glass">
            <div class="search-bar-container">
                <input type="text" id="search-staff" placeholder="Tìm kiếm nhân viên...">
            </div>
            <div id="staff-list-container"></div>
        </div>`;
        mainContent.innerHTML = content;
        
        if (docSnap.exists()) {
            const dayData = docSnap.data();
            updateStaffListView(dayData);
            document.getElementById('search-staff').addEventListener('input', (e) => updateStaffListView(dayData, e.target.value));
        } else {
             document.getElementById('staff-list-container').innerHTML = `<p>Chưa có dữ liệu cho hôm nay.</p>`;
        }
    }

    function updateStaffListView(dayData, searchTerm = '') {
        const staffOrders = Object.entries(dayData).map(([name, order]) => ({ name, ...order }));
        const filtered = staffOrders.filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()));

        const createListHTML = (list) => list.map(order => {
            const isEaten = order.status === 'eat';
            return `<li class="staff-item ${isEaten ? 'eaten' : ''}">
                <label class="eaten-checkbox">
                    <input type="checkbox" class="eaten-checkbox-input" data-name="${order.name}" ${isEaten ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                <div class="staff-details">
                    <span class="staff-name">${order.name}</span>
                    <span class="staff-dish">${parseDish(order.food)}</span>
                </div>
            </li>`;
        }).join('');
        
        const sang = filtered.filter(o => o.shift === 'Sáng').sort((a,b) => a.name.localeCompare(b.name));
        const chieu = filtered.filter(o => o.shift === 'Chiều').sort((a,b) => a.name.localeCompare(b.name));
        
        let html = '';
        if (sang.length > 0) html += `<div class="shift-group"><h3>Ca sáng</h3><ul class="staff-list">${createListHTML(sang)}</ul></div>`;
        if (chieu.length > 0) html += `<div class="shift-group"><h3>Ca Chiều</h3><ul class="staff-list">${createListHTML(chieu)}</ul></div>`;
        
        document.getElementById('staff-list-container').innerHTML = html || `<p>Không có kết quả.</p>`;
    }

    async function renderOrder() {
        const targetWeek = new Date().getDay() <= 3 ? state.thisWeekString : state.nextWeekString;
        const menuDoc = await getDoc(doc(db, targetWeek, "Menu"));

        if (!menuDoc.exists()) {
            mainContent.innerHTML = `<div class="card glass"><p>Thực đơn cho tuần tới chưa được cập nhật.</p></div>`;
            return;
        }
        
        const menu = menuDoc.data();
        const days = ["mon", "tue", "wed", "thu", "fri"];
        const dayNames = { mon: "Thứ 2", tue: "Thứ 3", wed: "Thứ 4", thu: "Thứ 5", fri: "Thứ 6"};

        let content = `<div class="card glass">
            <h2>Đặt món cho Tuần ${targetWeek.split('_')[1]}</h2>
            <div class="day-tabs">${days.map((day, i) => `<button class="day-tab ${i === 0 ? 'active' : ''}" data-day="${day}">${dayNames[day]}</button>`).join('')}</div>
            <div id="order-form-content"></div>
            <button id="submit-order-btn" class="btn-primary hidden">Hoàn tất đặt món</button>
        </div>`;
        mainContent.innerHTML = content;

        const renderDayOptions = (dayKey) => {
            const dishes = menu[dayKey]?.split(',').map(d => d.trim()) || [];
            document.getElementById('order-form-content').innerHTML = `
                <div class="dish-options">${dishes.map(dish => `
                    <div class="dish-option ${state.orderSelection[dayKey] === dish ? 'selected' : ''}" data-dish="${dish}" data-day-key="${dayKey}">
                        ${parseDish(dish)}
                    </div>`).join('')}
                </div>`;
        };

        renderDayOptions(days[0]);
        document.querySelector('.day-tabs').addEventListener('click', e => {
            if(e.target.classList.contains('day-tab')){
                document.querySelector('.day-tab.active').classList.remove('active');
                e.target.classList.add('active');
                renderDayOptions(e.target.dataset.day);
            }
        });
    }

    // --- LOGIC XÁC THỰC VÀ QUẢN LÝ USER ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            showLoader();
            state.currentUser = user;
            updateUIForUser(user);

            const staffRef = doc(db, "staff_list", "staffs");
            const staffSnap = await getDoc(staffRef);
            if (staffSnap.exists()) {
                const allStaff = staffSnap.data();
                state.staffProfile = allStaff[user.displayName] || {};
                 if (!allStaff[user.displayName]) {
                    // User mới, tạo entry cơ bản
                    await updateDoc(staffRef, { [user.displayName]: { email: user.email, depart: "", shift: "Sáng", lan: "vi" } });
                    state.staffProfile = { email: user.email, depart: "", shift: "Sáng", lan: "vi" };
                 }
                state.language = state.staffProfile.lan || 'vi';
            }
            await render();
            hideLoader();
        } else {
            state.currentUser = null;
            updateUIForUser(null);
        }
    });

    function updateUIForUser(user) {
        if (user) {
            userProfileDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${user.photoURL}" alt="avatar" style="width: 40px; height: 40px; border-radius: 50%;">
                    <div>
                        <h1 style="font-size: 1.2rem; margin: 0;">${user.displayName}</h1>
                        <button id="logout-btn" style="background:none; border:none; color:#a0a0b0; cursor:pointer; padding:0;">Đăng xuất</button>
                    </div>
                </div>`;
            settingsBtn.classList.remove('hidden');
            tabBar.classList.remove('hidden');
            mainContent.innerHTML = '';
            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        } else {
            userProfileDiv.innerHTML = `<h1>Inbold Menu</h1>`;
            settingsBtn.classList.add('hidden');
            tabBar.classList.add('hidden');
            mainContent.innerHTML = `<div class="card glass" style="text-align:center;">
                <h2>Chào mừng!</h2><p>Vui lòng đăng nhập để sử dụng ứng dụng.</p>
                <button id="login-btn" class="btn-primary">Đăng nhập bằng Google</button>
            </div>`;
            document.getElementById('login-btn').addEventListener('click', () => signInWithRedirect(auth, provider));
        }
    }

    // --- EVENT LISTENERS ---
    tabBar.addEventListener('click', async (e) => { /* ... */ });
    settingsBtn.addEventListener('click', () => { /* ... */ });
    // Thêm các event listener cho việc lưu settings, đặt món, xác nhận đã ăn...

    mainContent.addEventListener('click', async e => {
        // ... Thêm logic xử lý sự kiện click cho nút "Xác nhận đã ăn", checkbox, nút đặt món ...
    });

});
