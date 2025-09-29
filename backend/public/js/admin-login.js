// Admin login script with SMS verification
document.addEventListener('DOMContentLoaded', function () {
	const credentialsForm = document.getElementById('credentialsForm');
	const otpForm = document.getElementById('otpForm');
	const sendOtpBtn = document.getElementById('sendOtpBtn');
	const verifyOtpBtn = document.getElementById('verifyOtpBtn');
	const backBtn = document.getElementById('backBtn');
	const resendOtpBtn = document.getElementById('resendOtpBtn');
	const errorMessage = document.getElementById('errorMessage');
	const phoneInput = document.getElementById('phone');
	const otpInput = document.getElementById('otp');
	const timerElement = document.getElementById('timer');

	const credentialsStep = document.getElementById('credentialsStep');
	const otpStep = document.getElementById('otpStep');

	let otpExpiresAt = null;
	let remainingTime = 0;
	let resendCooldown = 0;
	let phoneNumber = '';

	// Telefon numarası formatı kontrolü
	phoneInput.addEventListener('input', function (e) {
		let value = e.target.value.replace(/\D/g, '');
		if (value.length > 11) {
			value = value.slice(0, 11);
		}
		e.target.value = value;
	});

	// OTP input - only numbers, max 6 digits
	otpInput.addEventListener('input', function (e) {
		let value = e.target.value.replace(/\D/g, '');
		if (value.length > 6) {
			value = value.slice(0, 6);
		}
		e.target.value = value;
	});

	// Credentials form submission
	credentialsForm.addEventListener('submit', async function (e) {
		e.preventDefault();

		const formData = new FormData(e.target);
		phoneNumber = formData.get('phone');
		const password = formData.get('password');

		// Validasyon
		if (phoneNumber.length < 11) {
			showError('Geçerli bir telefon numarası girin (11 hane)');
			return;
		}

		if (password.length < 1) {
			showError('Şifre alanı boş bırakılamaz');
			return;
		}

		setLoading(sendOtpBtn, true);
		hideError();

		try {
			const response = await fetch('/admin/validate-credentials', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ phone: phoneNumber, password }),
				credentials: 'include'
			});

			const result = await response.json();

			if (response.ok) {
				otpExpiresAt = new Date(result.data.expiresAt);
				remainingTime = 300; // 5 minutes
				resendCooldown = 120; // 2 minutes
				showOtpStep();
				startTimer();
			} else {
				showError(result.error || 'Doğrulama başarısız');
			}
		} catch (error) {
			showError('Bağlantı hatası: ' + error.message);
		} finally {
			setLoading(sendOtpBtn, false);
		}
	});

	// OTP form submission
	otpForm.addEventListener('submit', async function (e) {
		e.preventDefault();

		const otp = otpInput.value;

		if (otp.length !== 6) {
			showError('6 haneli doğrulama kodu girin');
			return;
		}

		setLoading(verifyOtpBtn, true);
		hideError();

		try {
			const response = await fetch('/admin/verify-otp', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ phone: phoneNumber, otp }),
				credentials: 'include'
			});

			const result = await response.json();

			if (response.ok) {
				// Başarılı giriş - yönlendir
				window.location.href = '/file-manager.html';
			} else {
				showError(result.error || 'Doğrulama başarısız');
			}
		} catch (error) {
			showError('Bağlantı hatası: ' + error.message);
		} finally {
			setLoading(verifyOtpBtn, false);
		}
	});

	// Back button
	backBtn.addEventListener('click', function () {
		showCredentialsStep();
		resetOtpForm();
	});

	// Resend OTP button
	resendOtpBtn.addEventListener('click', async function () {
		setLoading(resendOtpBtn, true, 'Gönderiliyor...');

		try {
			// Note: In a real implementation, you'd call a resend endpoint
			// For now, we'll just retry the validation
			const response = await fetch('/admin/validate-credentials', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					phone: phoneNumber,
					password: document.getElementById('password').value
				}),
				credentials: 'include'
			});

			const result = await response.json();

			if (response.ok) {
				otpExpiresAt = new Date(result.data.expiresAt);
				remainingTime = 300;
				resendCooldown = 120;
				otpInput.value = '';
				showError('Yeni kod gönderildi');
				setTimeout(() => hideError(), 3000);
			} else {
				showError(result.error || 'Kod gönderilemedi');
			}
		} catch (error) {
			showError('Bağlantı hatası: ' + error.message);
		} finally {
			setLoading(resendOtpBtn, false);
		}
	});

	function showCredentialsStep() {
		credentialsStep.classList.remove('hidden');
		otpStep.classList.add('hidden');
		phoneInput.focus();
	}

	function showOtpStep() {
		credentialsStep.classList.add('hidden');
		otpStep.classList.remove('hidden');
		otpInput.focus();
	}

	function resetOtpForm() {
		otpInput.value = '';
		remainingTime = 0;
		resendCooldown = 0;
		if (timerInterval) clearInterval(timerInterval);
	}

	let timerInterval;
	function startTimer() {
		if (timerInterval) clearInterval(timerInterval);

		timerInterval = setInterval(() => {
			remainingTime--;

			if (remainingTime <= 0) {
				clearInterval(timerInterval);
				timerElement.textContent = '00:00';
				showError('Doğrulama kodu süresi doldu');
				verifyOtpBtn.disabled = true;
				return;
			}

			const mins = Math.floor(remainingTime / 60);
			const secs = remainingTime % 60;
			timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

			// Handle resend cooldown
			if (resendCooldown > 0) {
				resendCooldown--;
				resendOtpBtn.disabled = true;
				const resendMins = Math.floor(resendCooldown / 60);
				const resendSecs = resendCooldown % 60;
				resendOtpBtn.textContent = `Tekrar SMS Gönder (${resendMins.toString().padStart(2, '0')}:${resendSecs.toString().padStart(2, '0')})`;
			} else {
				resendOtpBtn.disabled = false;
				resendOtpBtn.textContent = 'Tekrar SMS Gönder';
			}
		}, 1000);
	}

	function setLoading(button, loading, loadingText = null) {
		button.disabled = loading;
		const normalSpan = button.querySelector('.normal');
		const loadingSpan = button.querySelector('.loading');

		if (normalSpan && loadingSpan) {
			normalSpan.style.display = loading ? 'none' : 'inline';
			loadingSpan.style.display = loading ? 'inline' : 'none';
			if (loadingText) loadingSpan.textContent = loadingText;
		}
	}

	function showError(message) {
		errorMessage.textContent = message;
		errorMessage.style.display = 'block';
	}

	function hideError() {
		errorMessage.style.display = 'none';
	}

	// Sayfa yüklendiğinde telefon alanına odaklan
	phoneInput.focus();
});
