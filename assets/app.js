// Daily Business Snapshot Web App
// Author: [Your Name]
// Only HTML, CSS, JS (no external libraries)

// --- Constants ---
const MAX_ROWS = 100;
const DEFAULT_CUSTOMERS = [
    'Customer A', 'Customer B', 'Customer C', 'Customer D', 'Customer E'
];
const TABLE_COLUMNS = [
    { key: 'name', label: 'Name', editable: false },
    { key: 'purchase', label: 'Purchase', editable: true },
    { key: 'return', label: 'Return', editable: true },
    { key: 'sell', label: 'SELL', editable: false },
    { key: 'rate', label: 'Rate/PCS', editable: true },
    { key: 'netValue', label: 'NET VALUE', editable: false },
    { key: 'vc', label: 'VC', editable: true },
    { key: 'prevDue', label: 'Previous Due', editable: true },
    { key: 'total', label: 'TOTAL', editable: false },
    { key: 'view', label: '', editable: false },
    { key: 'delete', label: '', editable: false }
];

// --- State ---
let tableData = [];
let customerCount = 0;
let reportPage = 1;
const REPORTS_PER_PAGE = 5;
const CUSTOMER_LIST_KEY = 'customer-list';
const TABLE_DATA_KEY = 'table-data';

// --- Utility Functions ---
// Show live date under heading
window.addEventListener('DOMContentLoaded', function() {
    var dateDiv = document.getElementById('live-date');
    if (dateDiv) {
        function updateDate() {
            var now = new Date();
            var opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            dateDiv.textContent = now.toLocaleDateString('en-GB', opts);
        }
        updateDate();
        setInterval(updateDate, 60000);
    }
});
function getTodayStr() {
    const d = new Date();
    return d.toLocaleDateString('en-GB').split('/').reverse().join('-'); // yyyy-mm-dd
}
function formatDateForFile(dateStr) {
    const [yyyy, mm, dd] = dateStr.split('-');
    return `${dd}-${mm}-${yyyy}`;
}
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// --- Table Rendering ---
function renderTable() {
    const section = document.getElementById('table-section');
    let html = '<table id="main-table"><thead><tr>';
    for (const col of TABLE_COLUMNS) {
        // Add heading for view and delete columns
        if (col.key === 'view') html += `<th>View</th>`;
        else if (col.key === 'delete') html += `<th>Delete</th>`;
        else html += `<th>${col.label}</th>`;
    }
    html += '</tr></thead><tbody>';
    tableData.forEach((row, idx) => {
        html += '<tr>';
        TABLE_COLUMNS.forEach(col => {
            if (col.key === 'name') {
                html += `<td style="text-align:left;">
                    <input type="text" class="name-input" data-row="${idx}" value="${row.name}" readonly style="width:120px;" />
                    <span class="edit-icon" title="Edit Name" data-row="${idx}">&#9998;</span>
                </td>`;
            } else if (col.key === 'view') {
                html += `<td><span class="view-icon" title="View Data" data-row="${idx}">&#128065;</span></td>`;
            } else if (col.key === 'delete') {
                html += `<td><button class="delete-row-btn" title="Delete Row" data-row="${idx}">Delete</button></td>`;
            } else if (!col.editable) {
                // For SELL, Net Value, TOTAL: always show as non-editable and auto-calculated
                if (col.key === 'sell' || col.key === 'netValue' || col.key === 'total') {
                    html += `<td><span class="auto-cell">${row[col.key] !== undefined ? row[col.key] : ''}</span></td>`;
                } else {
                    html += `<td>${row[col.key] !== undefined ? row[col.key] : ''}</td>`;
                }
            } else {
                let type = col.key === 'name' ? 'text' : 'number';
                html += `<td><input type="${type}" min="0" step="1" data-row="${idx}" data-key="${col.key}" value="${row[col.key] !== undefined ? row[col.key] : ''}" ${col.key==='name'?'readonly':''}/></td>`;
            }
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    section.innerHTML = html;
    attachInputListeners();
    attachNameEditListeners();
    attachViewListeners();
    attachDeleteListeners();
}

function attachInputListeners() {
    // Select all editable inputs (not just type=number)
    document.querySelectorAll('#table-section input:not([readonly])').forEach(input => {
        // Update data model on input, but do not re-render
        input.addEventListener('input', e => {
            const idx = +input.dataset.row;
            const key = input.dataset.key;
            let val = input.value === '' ? 0 : +input.value;
            tableData[idx][key] = val;
            recalcRow(idx);
            saveTableData();
            // No renderTable() here, so focus/cursor is preserved
        });
        // Select all text on focus (mouse or keyboard)
        input.addEventListener('focus', e => {
            input.select();
        });
        // Also select all text on mouseup (for click after focus)
        input.addEventListener('mouseup', e => {
            setTimeout(() => input.select(), 0);
        });
        // Re-render table on blur (when user leaves the field)
        input.addEventListener('blur', e => {
            renderTable();
        });
        // On Enter or Tab, move to next editable input and select its text
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const inputs = Array.from(document.querySelectorAll('#table-section input:not([readonly])'));
                const idx = inputs.indexOf(input);
                if (idx !== -1 && idx < inputs.length - 1) {
                    inputs[idx + 1].focus();
                    inputs[idx + 1].select();
                } else {
                    input.blur();
                }
            }
        });
    });
}

function attachNameEditListeners() {
    document.querySelectorAll('.edit-icon').forEach(icon => {
        icon.onclick = function() {
            const idx = +icon.dataset.row;
            const input = document.querySelector(`input.name-input[data-row="${idx}"]`);
            input.removeAttribute('readonly');
            input.focus();
            input.select();
            input.onblur = function() {
                input.setAttribute('readonly', true);
                const newName = input.value.trim() || `Customer ${idx+1}`;
                tableData[idx].name = newName;
                saveCustomerList();
                saveTableData();
                renderTable();
            };
        };
    });
    document.querySelectorAll('.name-input').forEach(input => {
        input.onkeydown = function(e) {
            if (e.key === 'Enter') {
                input.blur();
            }
        };
    });
}

function attachViewListeners() {
    document.querySelectorAll('.view-icon').forEach(icon => {
        icon.onclick = function() {
            const idx = +icon.dataset.row;
            // Open a new tab with all saved data for this customer
            const name = tableData[idx].name;
            const allData = getAllCustomerHistory(name);
            const win = window.open('', '_blank');
            win.document.write('<html><head><title>Customer Data</title>');
            win.document.write('<style>body{font-family:sans-serif;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #888;padding:8px;text-align:center;}th{background:#eaf1fb;}</style>');
            win.document.write('</head><body>');
            win.document.write(`<h2>All Saved Data for ${name}</h2>`);
            win.document.write('<table><thead><tr><th>Date</th><th>Purchase</th><th>Return</th><th>SELL</th><th>Rate/PCS</th><th>NET VALUE</th><th>VC</th><th>Previous Due</th><th>TOTAL</th></tr></thead><tbody>');
            for (const entry of allData) {
                win.document.write(`<tr><td>${entry.date}</td><td>${entry.purchase}</td><td>${entry.return}</td><td>${entry.sell}</td><td>${entry.rate}</td><td>${entry.netValue}</td><td>${entry.vc}</td><td>${entry.prevDue !== undefined ? entry.prevDue : 0}</td><td>${entry.total}</td></tr>`);
            }
            win.document.write('</tbody></table></body></html>');
            win.document.close();
        };
    });
}
function attachDeleteListeners() {
    document.querySelectorAll('.delete-row-btn').forEach(btn => {
        btn.onclick = function() {
            const idx = +btn.dataset.row;
            if (confirm('Delete this customer row?')) {
                tableData.splice(idx, 1);
                customerCount = tableData.length;
                saveCustomerList();
                saveTableData();
                renderTable();
            }
        };
    });
}

function recalcRow(idx) {
    const row = tableData[idx];
    row.sell = (row.purchase || 0) - (row.return || 0);
    row.netValue = row.sell * (row.rate || 0);
    row.total = (row.netValue - (row.vc || 0)) + (row.prevDue || 0);
}

function recalcAll() {
    for (let i = 0; i < tableData.length; ++i) recalcRow(i);
}

// --- Table Data Management ---
function addCustomerRow(name = '') {
    if (customerCount >= MAX_ROWS) return;
    tableData.push({
        name: name || `Customer ${customerCount + 1}`,
        purchase: 0,
        return: 0,
        sell: 0,
        rate: 0,
        netValue: 0,
        vc: 0,
        prevDue: 0,
        total: 0
    });
    customerCount++;
    saveCustomerList();
    saveTableData();
    recalcAll();
    renderTable();
}

function initTable() {
    // Try to load from localStorage
    const saved = localStorage.getItem(TABLE_DATA_KEY);
    if (saved) {
        tableData = JSON.parse(saved);
        customerCount = tableData.length;
        recalcAll();
        renderTable();
        return;
    }
    // If not, load customer list
    const names = getCustomerList();
    tableData = [];
    customerCount = 0;
    for (const name of names) addCustomerRow(name);
    recalcAll();
    renderTable();
}
function saveCustomerList() {
    // Save only names
    const names = tableData.map(row => row.name);
    localStorage.setItem(CUSTOMER_LIST_KEY, JSON.stringify(names));
}

function getCustomerList() {
    const saved = localStorage.getItem(CUSTOMER_LIST_KEY);
    if (saved) return JSON.parse(saved);
    return DEFAULT_CUSTOMERS.slice();
}

function saveTableData() {
    localStorage.setItem(TABLE_DATA_KEY, JSON.stringify(tableData));
}
function getAllCustomerHistory(name) {
    // Search all saved reports for this customer name
    const dates = getAllReportDates();
    const result = [];
    for (const date of dates) {
        const report = getReportFromLocalStorage(date);
        if (Array.isArray(report)) {
            for (const row of report) {
                if (row.name === name) {
                    result.push({
                        date: formatDateForFile(date),
                        purchase: row.purchase,
                        return: row.return,
                        sell: row.sell,
                        rate: row.rate,
                        netValue: row.netValue,
                        vc: row.vc,
                        prevDue: row.prevDue !== undefined ? row.prevDue : 0,
                        total: row.total
                    });
                }
            }
        }
    }
    return result;
}

// --- Report Management ---
function saveReportToLocalStorage(dateStr, data) {
    // Limit to one report per day, and max 31 per month
    const month = dateStr.slice(0, 7); // yyyy-mm
    const all = getAllReportDates().filter(d => d.startsWith(month));
    if (all.length >= 31 && !all.includes(dateStr)) {
        alert('You can only save up to 31 daily reports per calendar month.');
        return;
    }
    const key = `report-${dateStr}`;
    localStorage.setItem(key, JSON.stringify(data));
}
function getReportFromLocalStorage(dateStr) {
    return JSON.parse(localStorage.getItem(`report-${dateStr}`));
}
function deleteReportFromLocalStorage(dateStr) {
    localStorage.removeItem(`report-${dateStr}`);
}
function getAllReportDates() {
    return Object.keys(localStorage)
        .filter(k => k.startsWith('report-'))
        .map(k => k.replace('report-', ''))
        .sort((a, b) => b.localeCompare(a));
}
function clearAllReports() {
    for (const k of Object.keys(localStorage)) {
        if (k.startsWith('report-')) localStorage.removeItem(k);
    }
}

// --- Report List UI ---
function renderReportList() {
    const ul = document.getElementById('report-list');
    ul.innerHTML = '';
    const allDates = getAllReportDates();
    const totalPages = Math.ceil(allDates.length / REPORTS_PER_PAGE) || 1;
    if (reportPage > totalPages) reportPage = totalPages;
    if (reportPage < 1) reportPage = 1;
    const startIdx = (reportPage - 1) * REPORTS_PER_PAGE;
    const pageDates = allDates.slice(startIdx, startIdx + REPORTS_PER_PAGE);
    for (const dateStr of pageDates) {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${formatDateForFile(dateStr)}</span>
            <span class="report-actions">
                <div class="download-dropdown" style="display:inline-block;position:relative;">
                    <button class="download-btn" data-date="${dateStr}" title="Download">Download ▼</button>
                    <div class="dropdown-content" style="display:none;position:absolute;z-index:10;background:#fff;border:1px solid #ccc;min-width:120px;box-shadow:0 2px 8px #0001;">
                        <button class="download-pdf animated-btn" data-date="${dateStr}" style="width:100%;text-align:left;padding:6px 12px;border:none;background:none;cursor:pointer;display:flex;align-items:center;gap:8px;">
                            <span style="display:inline-block;vertical-align:middle;">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="20" height="20" rx="4" fill="#d7263d"/>
                                    <text x="10" y="15" text-anchor="middle" fill="#fff" font-size="10" font-family="Segoe UI,Arial,sans-serif">PDF</text>
                                </svg>
                            </span>
                            <span style="font-weight:500;">PDF</span>
                        </button>
                        <button class="download-xls animated-btn" data-date="${dateStr}" style="width:100%;text-align:left;padding:6px 12px;border:none;background:none;cursor:pointer;display:flex;align-items:center;gap:8px;">
                            <span style="display:inline-block;vertical-align:middle;">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="20" height="20" rx="4" fill="#217346"/>
                                    <text x="10" y="15" text-anchor="middle" fill="#fff" font-size="10" font-family="Segoe UI,Arial,sans-serif">XLS</text>
                                </svg>
                            </span>
                            <span style="font-weight:500;">Excel</span>
                        </button>
                    </div>
                </div>
                <button class="delete-report-btn" data-date="${dateStr}" title="Delete" style="margin-left:8px;">Delete</button>
            </span>
        `;
        ul.appendChild(li);
    }
    // Paging controls
    let pagingDiv = document.getElementById('report-paging');
    if (!pagingDiv) {
        pagingDiv = document.createElement('div');
        pagingDiv.id = 'report-paging';
        ul.parentElement.appendChild(pagingDiv);
    }
    pagingDiv.style.margin = '12px 0';
    pagingDiv.style.textAlign = 'center';
    pagingDiv.innerHTML = `
        <button id="prev-report-page" ${reportPage === 1 ? 'disabled' : ''}>Prev</button>
        <span style="margin:0 12px;">Page ${reportPage} of ${totalPages}</span>
        <button id="next-report-page" ${reportPage === totalPages ? 'disabled' : ''}>Next</button>
    `;
    attachReportListListeners();
    // Paging button listeners
    document.getElementById('prev-report-page').onclick = function() {
        if (reportPage > 1) {
            reportPage--;
            renderReportList();
        }
    };
    document.getElementById('next-report-page').onclick = function() {
        if (reportPage < totalPages) {
            reportPage++;
            renderReportList();
        }
    };
}
function attachReportListListeners() {
    // Dropdown logic for download
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            // Hide all other dropdowns
            document.querySelectorAll('.dropdown-content').forEach(dc => { dc.style.display = 'none'; });
            const dropdown = btn.parentElement.querySelector('.dropdown-content');
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        };
    });
    // Hide dropdown on click outside
    document.addEventListener('click', function(e) {
        document.querySelectorAll('.dropdown-content').forEach(dc => { dc.style.display = 'none'; });
    });
    // Download PDF
    document.querySelectorAll('.download-pdf').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            const dateStr = btn.dataset.date;
            const data = getReportFromLocalStorage(dateStr);
            if (data) downloadPDF(data, dateStr);
        };
    });
    // Download Excel
    document.querySelectorAll('.download-xls').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            const dateStr = btn.dataset.date;
            const data = getReportFromLocalStorage(dateStr);
            if (data) downloadXLS(data, dateStr);
        };
    });
    // Delete button
    document.querySelectorAll('.delete-report-btn').forEach(btn => {
        btn.onclick = function() {
            const dateStr = btn.dataset.date;
            if (confirm('Delete this report?')) {
                deleteReportFromLocalStorage(dateStr);
                renderReportList();
            }
        };
    });
}

// --- Download Helpers ---
function tableDataToXLS(data, dateStr) {
    let xls = '<table border="1"><tr>';
    for (const col of TABLE_COLUMNS) {
        if (col.key !== 'view') xls += `<th>${col.label}</th>`;
    }
    xls += '</tr>';
    for (const row of data) {
        xls += '<tr>';
        for (const col of TABLE_COLUMNS) {
            if (col.key !== 'view') xls += `<td>${row[col.key] !== undefined ? row[col.key] : ''}</td>`;
        }
        xls += '</tr>';
    }
    xls += '</table>';
    return xls;
}
function downloadXLS(data, dateStr, filenamePrefix = 'Date') {
    const xls = tableDataToXLS(data, dateStr);
    const blob = new Blob([xls], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${formatDateForFile(dateStr)}.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
function downloadCombinedXLS(reports, fromDate, toDate) {
    let xls = '';
    for (const { date, data } of reports) {
        xls += `<h3>Date: ${formatDateForFile(date)}</h3>`;
        xls += tableDataToXLS(data, date);
        xls += '<br/>';
    }
    const blob = new Blob([xls], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reports-${formatDateForFile(fromDate)}-to-${formatDateForFile(toDate)}.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// --- PDF Download (Simple Table as Image) ---
function downloadPDF(data, dateStr, filenamePrefix = 'Date') {
    // Render table as HTML, then use canvas to image, then download as PDF
    // No external libs, so use window.print() in a new window
    const win = window.open('', '', 'width=900,height=700');
    win.document.write('<html><head><title>PDF Export</title>');
    win.document.write('<style>body{font-family:sans-serif;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #888;padding:8px;text-align:center;}th{background:#eaf1fb;}</style>');
    win.document.write('</head><body>');
    win.document.write(`<h2>Daily Business Snapshot - ${formatDateForFile(dateStr)}</h2>`);
    win.document.write(tableDataToXLS(data, dateStr));
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    win.print();
}
function downloadCombinedPDF(reports, fromDate, toDate) {
    const win = window.open('', '', 'width=900,height=700');
    win.document.write('<html><head><title>PDF Export</title>');
    win.document.write('<style>body{font-family:sans-serif;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #888;padding:8px;text-align:center;}th{background:#eaf1fb;}h3{margin:18px 0 6px 0;}</style>');
    win.document.write('</head><body>');
    win.document.write(`<h2>Daily Business Snapshot<br>From ${formatDateForFile(fromDate)} To ${formatDateForFile(toDate)}</h2>`);
    for (const { date, data } of reports) {
        win.document.write(`<h3>Date: ${formatDateForFile(date)}</h3>`);
        win.document.write(tableDataToXLS(data, date));
    }
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    win.print();
}

// --- Download Option Dialog ---
function showDownloadOptions(dateStr) {
    const data = getReportFromLocalStorage(dateStr);
    if (!data) return;
    const opt = prompt('Download as: 1) Excel  2) PDF\nEnter 1 or 2:', '1');
    if (opt === '2') downloadPDF(data, dateStr);
    else downloadXLS(data, dateStr);
}

// --- Date Range Download ---
function handleRangeDownload(type) {
    const from = document.getElementById('from-date').value;
    const to = document.getElementById('to-date').value;
    if (!from || !to) return alert('Select both dates.');
    const all = getAllReportDates();
    const reports = all.filter(d => d >= from && d <= to).map(date => ({ date, data: getReportFromLocalStorage(date) }));
    if (!reports.length) return alert('No reports in range.');
    if (type === 'pdf') downloadCombinedPDF(reports, from, to);
    else downloadCombinedXLS(reports, from, to);
}

// --- Chart Modal ---
function openChartModal(idx) {
    const modal = document.getElementById('chart-modal');
    const canvas = document.getElementById('customer-chart');
    const row = tableData[idx];
    // Clear canvas
    canvas.width = 350; canvas.height = 250;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Simple bar chart: Purchase, Return, SELL, Net Value, VC, Previous Due, TOTAL
    const labels = ['Purchase','Return','SELL','Net Value','VC','Previous Due','TOTAL'];
    const values = [row.purchase, row.return, row.sell, row.netValue, row.vc, row.prevDue, row.total];
    const colors = ['#0078d7','#d7263d','#00b386','#fbb034','#a259f7','#ff6f61','#222'];
    const max = Math.max(...values.map(v=>Math.abs(v)));
    const barW = 32;
    const gap = 18;
    const baseY = 210;
    ctx.font = '13px Segoe UI';
    for (let i=0; i<values.length; ++i) {
        const h = (values[i]/max)*120 || 0;
        ctx.fillStyle = colors[i];
        ctx.fillRect(30+i*(barW+gap), baseY-h, barW, h);
        ctx.fillStyle = '#333';
        ctx.fillText(labels[i], 30+i*(barW+gap), baseY+18);
        ctx.fillText(values[i], 30+i*(barW+gap), baseY-h-8);
    }
    modal.style.display = 'flex';
}
function closeChartModal() {
    document.getElementById('chart-modal').style.display = 'none';
}
function attachModalListeners() {
    document.querySelector('.modal .close').onclick = closeChartModal;
    window.onclick = function(e) {
        const modal = document.getElementById('chart-modal');
        if (e.target === modal) closeChartModal();
    };
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    initTable();
    renderReportList();
    attachModalListeners();
    document.getElementById('add-row').onclick = function() {
        addCustomerRow();
    };
    document.getElementById('submit').onclick = function() {
        const today = getTodayStr();
        recalcAll();
        saveReportToLocalStorage(today, deepClone(tableData));
        renderReportList();
        alert('Report saved!');
        // Animate table on submit
        const table = document.getElementById('main-table');
        if (table) {
            table.classList.remove('table-submit-animate');
            // Force reflow to restart animation
            void table.offsetWidth;
            table.classList.add('table-submit-animate');
        }
    };
    document.getElementById('clear-reports').onclick = function() {
        if (confirm('Delete ALL reports?')) {
            clearAllReports();
            renderReportList();
        }
    };
    // Dropdown logic for Download Range
    const rangeBtn = document.getElementById('download-range');
    const dropdown = document.getElementById('download-range-dropdown');
    rangeBtn.onclick = function(e) {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    };
    document.querySelectorAll('.download-range-pdf').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            dropdown.style.display = 'none';
            handleRangeDownload('pdf');
        };
    });
    document.querySelectorAll('.download-range-xls').forEach(btn => {
        btn.onclick = function(e) {
            e.stopPropagation();
            dropdown.style.display = 'none';
            handleRangeDownload('xls');
        };
    });
    // Hide dropdown on click outside
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target) && e.target !== rangeBtn) {
            dropdown.style.display = 'none';
        }
    });
});
