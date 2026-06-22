// if a page needs login and nobody is logged in, go to login and come back after
if (document.body.hasAttribute('data-requires-auth') && !localStorage.getItem('user')) {
  const here = window.location.pathname.split('/').pop() || 'dashboard.html';
  window.location.href = 'login.html?next=' + encodeURIComponent(here);
}

// mobile menu button
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', function () {
    const isOpen = mainNav.classList.toggle('is-open');
    menuToggle.classList.toggle('is-active');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });
}

// header: name + logout when logged in, otherwise a login link
const authArea = document.getElementById('authArea');
const savedUser = localStorage.getItem('user');

if (authArea) {
  if (savedUser) {
    const user = JSON.parse(savedUser);

    authArea.innerHTML =
      '<span class="auth-welcome">Hi, ' + user.name + '</span>' +
      '<a href="dashboard.html" class="btn btn-ghost btn-small">Dashboard</a>' +
      '<button type="button" id="logoutBtn" class="btn btn-ghost btn-small">Log Out</button>';

    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  } else {
    authArea.innerHTML = '<a href="login.html" class="btn btn-primary btn-small">Login</a>';
  }
}

// "Book an Appointment" buttons: members go straight to booking, guests log in first
document.querySelectorAll('.book-link').forEach(function (link) {
  link.href = savedUser ? 'booking.html' : 'login.html?next=booking.html';
});

// where to send someone after they log in: the page they wanted, or the dashboard
function redirectAfterAuth() {
  const next = new URLSearchParams(window.location.search).get('next');
  return (next && /^[a-z0-9_-]+\.html$/i.test(next)) ? next : 'dashboard.html';
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (err) {
    console.log('logout request failed, clearing local session anyway');
  }

  localStorage.removeItem('user');
  localStorage.removeItem('token');
  window.location.href = 'index.html';
}

// login
const loginForm = document.getElementById('loginForm');

if (loginForm) {
  if (savedUser) {
    // already logged in, skip the form
    window.location.href = redirectAfterAuth();
  } else {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const errorMessage = document.getElementById('errorMessage');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  errorMessage.classList.remove('is-visible');
  errorMessage.textContent = '';

  if (!email || !password) {
    showFormError('Please enter your email and password.');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });

    const data = await response.json();

    if (!response.ok) {
      showFormError(data.message || 'Could not log in. Please try again.');
      return;
    }

    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token', data.token);
    window.location.href = redirectAfterAuth();

  } catch (err) {
    showFormError('Could not reach the server. Please try again.');
  }
}

// register
const registerForm = document.getElementById('registerForm');

if (registerForm) {
  if (savedUser) {
    window.location.href = redirectAfterAuth();
  } else {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!name || !email || !phone || !password || !confirmPassword) {
    showFormError('Please fill in all fields.');
    return;
  }

  if (password !== confirmPassword) {
    showFormError('Passwords do not match.');
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password, confirmPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      showFormError(data.message || 'Could not create your account. Please try again.');
      return;
    }

    window.location.href = 'login.html?registered=true';

  } catch (err) {
    showFormError('Could not reach the server. Please try again.');
  }
}

function showFormError(message) {
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorMessage.classList.remove('form-success'); // make sure an error is always red
  errorMessage.classList.add('is-visible');
}

// green note on the login page after registering
if (window.location.search.includes('registered=true')) {
  const errorMessage = document.getElementById('errorMessage');
  if (errorMessage) {
    errorMessage.textContent = 'Account created successfully. Please log in.';
    errorMessage.classList.add('is-visible', 'form-success');
  }
}

// dashboard account details
const welcomeHeading = document.getElementById('welcomeHeading');

if (welcomeHeading && savedUser) {
  const user = JSON.parse(savedUser);

  welcomeHeading.textContent = 'Welcome back, ' + user.name;
  document.getElementById('accName').textContent = user.name;
  document.getElementById('accEmail').textContent = user.email;
  document.getElementById('accRole').textContent =
    user.role.charAt(0).toUpperCase() + user.role.slice(1);
}

// services page
const servicesList = document.getElementById('servicesList');

if (servicesList) {
  loadServices();
}

async function loadServices() {
  try {
    const response = await fetch('/api/services');
    const services = await response.json();

    if (services.length === 0) {
      servicesList.innerHTML = '<p>No services are listed right now.</p>';
      return;
    }

    servicesList.innerHTML = services.map(function (service) {
      return '<article class="service-row">' +
        '<div>' +
          '<h3>' + service.name + '</h3>' +
          '<p>' + (service.description || '') + '</p>' +
          '<span class="service-duration">' + service.duration_minutes + ' minutes</span>' +
        '</div>' +
        '<div class="service-price">R' + Number(service.base_price).toFixed(2) + '</div>' +
      '</article>';
    }).join('');

  } catch (err) {
    servicesList.innerHTML = '<p class="form-error is-visible">Could not load services right now.</p>';
  }
}

// contact form
const contactForm = document.getElementById('contactForm');

if (contactForm) {
  contactForm.addEventListener('submit', handleContactSubmit);
}

async function handleContactSubmit(event) {
  event.preventDefault();

  const contactError = document.getElementById('contactError');
  const contactSuccess = document.getElementById('contactSuccess');
  contactError.classList.remove('is-visible');
  contactSuccess.classList.remove('is-visible');

  const name = document.getElementById('cName').value.trim();
  const email = document.getElementById('cEmail').value.trim();
  const subject = document.getElementById('cSubject').value;
  const message = document.getElementById('cMessage').value.trim();
  const website = document.getElementById('website').value; // honeypot

  if (!name || !email || !message) {
    contactError.textContent = 'Please fill in all fields.';
    contactError.classList.add('is-visible');
    return;
  }

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject, message, website })
    });

    const data = await response.json();

    if (!response.ok) {
      contactError.textContent = data.message || 'Could not send your message.';
      contactError.classList.add('is-visible');
      return;
    }

    contactSuccess.textContent = data.message;
    contactSuccess.classList.add('is-visible');
    contactForm.reset();

  } catch (err) {
    contactError.textContent = 'Could not reach the server. Please try again.';
    contactError.classList.add('is-visible');
  }
}

// dashboard pets
const petList = document.getElementById('petList');
const addPetForm = document.getElementById('addPetForm');

if (petList) {
  loadPets();
}

async function loadPets() {
  try {
    const response = await fetch('/api/pets', {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
    });

    if (!response.ok) {
      petList.innerHTML = '<p class="form-error is-visible">Could not load your pets.</p>';
      return;
    }

    const pets = await response.json();

    if (pets.length === 0) {
      petList.innerHTML = '<p>You haven\'t added any pets yet.</p>';
      return;
    }

    petList.innerHTML = pets.map(function (pet) {
      return '<article class="pet-card">' +
        '<h3>' + pet.name + '</h3>' +
        '<p>' + pet.species + (pet.breed ? ' — ' + pet.breed : '') + '</p>' +
      '</article>';
    }).join('');

  } catch (err) {
    petList.innerHTML = '<p class="form-error is-visible">Could not reach the server.</p>';
  }
}

if (addPetForm) {
  addPetForm.addEventListener('submit', handleAddPetSubmit);
}

async function handleAddPetSubmit(event) {
  event.preventDefault();

  const petError = document.getElementById('petError');
  petError.classList.remove('is-visible');

  const name = document.getElementById('petName').value.trim();
  const species = document.getElementById('petSpecies').value.trim();
  const breed = document.getElementById('petBreed').value.trim();
  const dateOfBirth = document.getElementById('petDob').value;

  if (!name || !species) {
    petError.textContent = 'Pet name and species are required.';
    petError.classList.add('is-visible');
    return;
  }

  try {
    const response = await fetch('/api/pets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ name, species, breed, dateOfBirth })
    });

    const data = await response.json();

    if (!response.ok) {
      petError.textContent = data.message || 'Could not add your pet.';
      petError.classList.add('is-visible');
      return;
    }

    addPetForm.reset();
    loadPets();

  } catch (err) {
    petError.textContent = 'Could not reach the server.';
    petError.classList.add('is-visible');
  }
}

// small helpers used by booking + dashboard
function authHeader() {
  return { Authorization: 'Bearer ' + localStorage.getItem('token') };
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// yyyy-mm-dd from the local date (not UTC, so the day doesn't shift)
function localDateString(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

// booking page
const bookingForm = document.getElementById('bookingForm');

if (bookingForm) {
  setupBookingPage();
}

async function setupBookingPage() {
  const petSelect = document.getElementById('bPet');
  const serviceSelect = document.getElementById('bService');
  const vetSelect = document.getElementById('bVet');
  const dateInput = document.getElementById('bDate');
  const timeSelect = document.getElementById('bTime');
  const summary = document.getElementById('bookingSummary');
  const bookingError = document.getElementById('bookingError');
  const bookingSuccess = document.getElementById('bookingSuccess');
  const submitBtn = bookingForm.querySelector('button[type="submit"]');

  let servicesById = {};

  function showBookingError(msg) {
    bookingError.textContent = msg;
    bookingError.classList.add('is-visible');
  }

  // earliest you can book is tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = localDateString(tomorrow);
  dateInput.min = minDate;
  dateInput.value = minDate;

  // build the time options, every 30 min from 08:00 to 16:30
  const slots = [];
  for (let h = 8; h <= 16; h++) {
    slots.push(pad(h) + ':00');
    slots.push(pad(h) + ':30');
  }
  timeSelect.innerHTML = '<option value="">Select a time</option>' +
    slots.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('');

  // load the user's pets
  try {
    const petRes = await fetch('/api/pets', { headers: authHeader() });
    if (!petRes.ok) {
      petSelect.innerHTML = '<option value="">Unavailable</option>';
      showBookingError('Could not load your pets. Please log out and log in again.');
    } else {
      const pets = await petRes.json();
      if (pets.length === 0) {
        petSelect.innerHTML = '<option value="">No pets yet</option>';
        showBookingError('You need to add a pet on your dashboard before you can book.');
        if (submitBtn) submitBtn.disabled = true;
      } else {
        petSelect.innerHTML = pets.map(function (p) {
          return '<option value="' + p.pet_id + '">' + p.name + '</option>';
        }).join('');
      }
    }
  } catch (err) {
    showBookingError('Could not reach the server. Please try again.');
  }

  // load services and keep their price for the summary
  try {
    const svcRes = await fetch('/api/services');
    const services = await svcRes.json();
    serviceSelect.innerHTML = services.map(function (s) {
      servicesById[s.service_id] = s;
      return '<option value="' + s.service_id + '">' +
        s.name + ' — R' + Number(s.base_price).toFixed(2) + '</option>';
    }).join('');
  } catch (err) {
    serviceSelect.innerHTML = '<option value="">Could not load services</option>';
  }

  // load vets
  try {
    const vetRes = await fetch('/api/vets');
    const vets = await vetRes.json();
    vetSelect.innerHTML = vets.map(function (v) {
      return '<option value="' + v.vet_id + '">' +
        v.name + (v.specialisation ? ' (' + v.specialisation + ')' : '') + '</option>';
    }).join('');
  } catch (err) {
    vetSelect.innerHTML = '<option value="">Could not load vets</option>';
  }

  // rebuild the summary whenever a field changes
  function updateSummary() {
    const service = servicesById[serviceSelect.value];
    if (!service || !petSelect.value || !vetSelect.value || !dateInput.value || !timeSelect.value) {
      summary.innerHTML = '';
      return;
    }
    const petText = petSelect.options[petSelect.selectedIndex].text;
    const vetText = vetSelect.options[vetSelect.selectedIndex].text;
    summary.innerHTML =
      '<h3>Booking summary</h3>' +
      '<div class="summary-row"><span>Pet</span><span>' + petText + '</span></div>' +
      '<div class="summary-row"><span>Service</span><span>' + service.name + '</span></div>' +
      '<div class="summary-row"><span>Vet</span><span>' + vetText + '</span></div>' +
      '<div class="summary-row"><span>When</span><span>' + dateInput.value + ' at ' + timeSelect.value + '</span></div>' +
      '<div class="summary-row summary-total"><span>Estimated cost</span><span>R' + Number(service.base_price).toFixed(2) + '</span></div>';
  }

  [petSelect, serviceSelect, vetSelect, dateInput, timeSelect].forEach(function (el) {
    el.addEventListener('change', updateSummary);
  });

  bookingForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    bookingError.classList.remove('is-visible');
    bookingSuccess.classList.remove('is-visible');

    const petId = petSelect.value;
    const serviceId = serviceSelect.value;
    const vetId = vetSelect.value;
    const notes = document.getElementById('bNotes').value.trim();

    if (!petId || !serviceId || !vetId || !dateInput.value || !timeSelect.value) {
      showBookingError('Please choose a pet, service, vet, date and time.');
      return;
    }

    // no timezone here so the browser reads it as local time
    const dateTime = dateInput.value + 'T' + timeSelect.value;

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
        body: JSON.stringify({ petId, serviceId, vetId, dateTime, notes })
      });
      const data = await response.json();
      if (!response.ok) {
        showBookingError(data.message || 'Could not book your appointment.');
        return;
      }
      bookingSuccess.textContent = data.message + ' Taking you to your dashboard…';
      bookingSuccess.classList.add('is-visible');
      setTimeout(function () { window.location.href = 'dashboard.html'; }, 1500);
    } catch (err) {
      showBookingError('Could not reach the server. Please try again.');
    }
  });
}

// dashboard appointments
const apptList = document.getElementById('apptList');

if (apptList) {
  loadAppointments();
}

async function loadAppointments() {
  try {
    const response = await fetch('/api/appointments', { headers: authHeader() });
    if (!response.ok) {
      apptList.innerHTML = '<p class="form-error is-visible">Could not load your appointments.</p>';
      return;
    }
    const appts = await response.json();
    if (appts.length === 0) {
      apptList.innerHTML = '<p>You have no appointments yet. Use “Book New” to schedule one.</p>';
      return;
    }
    apptList.innerHTML = appts.map(function (a) {
      const cancellable = (a.status === 'pending' || a.status === 'confirmed');
      return '<article class="appt-card">' +
        '<div class="appt-card-info">' +
          '<h3>' + a.service_name + '</h3>' +
          '<p>' + a.pet_name + ' · ' + a.vet_name + '</p>' +
          '<p class="appt-time">' + formatDateTime(a.date_time) + '</p>' +
        '</div>' +
        '<div class="appt-card-right">' +
          '<span class="status-badge status-badge--' + a.status + '">' + a.status.replace('_', ' ') + '</span>' +
          (cancellable
            ? '<button type="button" class="btn btn-ghost btn-small" data-cancel-appt="' + a.appt_id + '">Cancel</button>'
            : '') +
        '</div>' +
      '</article>';
    }).join('');

    apptList.querySelectorAll('[data-cancel-appt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        cancelAppointment(btn.getAttribute('data-cancel-appt'));
      });
    });
  } catch (err) {
    apptList.innerHTML = '<p class="form-error is-visible">Could not reach the server.</p>';
  }
}

async function cancelAppointment(apptId) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    const response = await fetch('/api/appointments/' + apptId + '/cancel', {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
      body: JSON.stringify({ reason: 'Cancelled by owner' })
    });
    if (response.ok) {
      loadAppointments();
      if (document.getElementById('notifList')) loadNotifications();
    }
  } catch (err) {
    // leave the list as it is if this fails
  }
}

// dashboard invoices
const invoiceList = document.getElementById('invoiceList');

if (invoiceList) {
  loadInvoices();
}

async function loadInvoices() {
  try {
    const response = await fetch('/api/invoices', { headers: authHeader() });
    if (!response.ok) {
      invoiceList.innerHTML = '<p class="form-error is-visible">Could not load your invoices.</p>';
      return;
    }
    const invoices = await response.json();
    if (invoices.length === 0) {
      invoiceList.innerHTML = '<p>You have no invoices yet.</p>';
      return;
    }
    invoiceList.innerHTML = invoices.map(function (inv) {
      return '<article class="invoice-card">' +
        '<div class="invoice-card-info">' +
          '<h3>' + inv.service_name + '</h3>' +
          '<p>' + inv.pet_name + ' · ' + formatDateTime(inv.date_time) + '</p>' +
        '</div>' +
        '<div class="invoice-card-right">' +
          '<span class="invoice-amount">R' + Number(inv.total_amount).toFixed(2) + '</span>' +
          '<span class="invoice-status invoice-status--' + inv.status + '">' + inv.status + '</span>' +
          (inv.status === 'unpaid'
            ? '<button type="button" class="btn-pay" data-pay-invoice="' + inv.invoice_id + '">Pay Now</button>'
            : '') +
        '</div>' +
      '</article>';
    }).join('');

    invoiceList.querySelectorAll('[data-pay-invoice]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        payInvoice(btn.getAttribute('data-pay-invoice'), btn);
      });
    });
  } catch (err) {
    invoiceList.innerHTML = '<p class="form-error is-visible">Could not reach the server.</p>';
  }
}

async function payInvoice(invoiceId, btn) {
  btn.disabled = true;
  btn.textContent = 'Processing…';
  try {
    const response = await fetch('/api/invoices/' + invoiceId + '/pay', {
      method: 'POST',
      headers: authHeader()
    });
    if (response.ok) {
      loadInvoices();
      if (document.getElementById('notifList')) loadNotifications();
    } else {
      btn.disabled = false;
      btn.textContent = 'Pay Now';
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Pay Now';
  }
}

// dashboard notifications
const notifList = document.getElementById('notifList');

if (notifList) {
  loadNotifications();
}

async function loadNotifications() {
  const notifBadge = document.getElementById('notifBadge');
  try {
    const response = await fetch('/api/notifications', { headers: authHeader() });
    if (!response.ok) {
      notifList.innerHTML = '<p class="form-error is-visible">Could not load notifications.</p>';
      return;
    }
    const notifs = await response.json();
    if (notifs.length === 0) {
      notifList.innerHTML = '<p>No notifications yet.</p>';
      if (notifBadge) notifBadge.textContent = '';
      return;
    }
    const unread = notifs.filter(function (n) { return !n.is_read; }).length;
    if (notifBadge) notifBadge.textContent = unread > 0 ? String(unread) : '';

    notifList.innerHTML = notifs.map(function (n) {
      const unreadClass = n.is_read ? '' : ' notif-item--unread';
      const clickAttr = n.is_read ? '' : ' data-notif="' + n.notif_id + '"';
      return '<div class="notif-item' + unreadClass + '"' + clickAttr + '>' +
        '<p>' + n.message + '</p>' +
        '<p class="notif-time">' + formatDateTime(n.sent_at) + '</p>' +
      '</div>';
    }).join('');

    notifList.querySelectorAll('[data-notif]').forEach(function (item) {
      item.addEventListener('click', function () {
        markNotificationRead(item.getAttribute('data-notif'));
      });
    });
  } catch (err) {
    notifList.innerHTML = '<p class="form-error is-visible">Could not reach the server.</p>';
  }
}

async function markNotificationRead(notifId) {
  try {
    const response = await fetch('/api/notifications/' + notifId + '/read', {
      method: 'PATCH',
      headers: authHeader()
    });
    if (response.ok) loadNotifications();
  } catch (err) {
    // ignore, it refreshes on the next load
  }
}
