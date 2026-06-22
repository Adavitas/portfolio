// main.js

document.documentElement.classList.add('js-enabled');

document.addEventListener('DOMContentLoaded', () => {
    // Dynamic Time Display
    const timeElement = document.getElementById('local-time');

    if (timeElement) {
        function updateTime() {
            const now = new Date();
            timeElement.textContent = now.toLocaleTimeString();
        }

        // Initial call and set interval
        updateTime();
        setInterval(updateTime, 1000);
    }

    // Responsive Navigation
    const menuButton = document.querySelector('.menu-button');
    const menuButtonLabel = document.querySelector('.menu-button-label');
    const navigation = document.getElementById('nav-links');

    if (menuButton && menuButtonLabel && navigation) {
        function setMenuState(isOpen) {
            navigation.classList.toggle('is-open', isOpen);
            menuButton.setAttribute('aria-expanded', String(isOpen));
            menuButtonLabel.textContent = isOpen ? 'Close' : 'Menu';
        }

        menuButton.addEventListener('click', () => {
            const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
            setMenuState(!isOpen);
        });

        navigation.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                setMenuState(false);
            });
        });

        document.addEventListener('keydown', (event) => {
            const isOpen = menuButton.getAttribute('aria-expanded') === 'true';

            if (event.key === 'Escape' && isOpen) {
                setMenuState(false);
                menuButton.focus();
            }
        });

        const desktopLayout = window.matchMedia('(min-width: 700px)');

        desktopLayout.addEventListener('change', (event) => {
            if (event.matches) {
                setMenuState(false);
            }
        });
    }

    // Contact Form Validation and Email Draft
    const contactForm = document.getElementById('contact-form');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    const nameError = document.getElementById('name-error');
    const emailError = document.getElementById('email-error');
    const messageError = document.getElementById('message-error');
    const formStatus = document.getElementById('form-status');
    const emailDraftLink = document.getElementById('email-draft-link');

    if (
        contactForm &&
        nameInput &&
        emailInput &&
        messageInput &&
        nameError &&
        emailError &&
        messageError &&
        formStatus &&
        emailDraftLink
    ) {
        const fields = [
            { input: nameInput, error: nameError },
            { input: emailInput, error: emailError },
            { input: messageInput, error: messageError },
        ];

        contactForm.noValidate = true;

        function clearFieldError(input, errorElement) {
            input.removeAttribute('aria-invalid');
            errorElement.textContent = '';
        }

        function showFieldError(input, errorElement, message) {
            input.setAttribute('aria-invalid', 'true');
            errorElement.textContent = message;
        }

        function resetPreparedEmail() {
            formStatus.textContent = '';
            formStatus.className = 'form-status';
            emailDraftLink.hidden = true;
            emailDraftLink.removeAttribute('href');
        }

        fields.forEach(({ input, error }) => {
            input.addEventListener('input', () => {
                clearFieldError(input, error);
                resetPreparedEmail();
            });
        });

        contactForm.addEventListener('submit', (event) => {
            event.preventDefault();

            fields.forEach(({ input, error }) => {
                clearFieldError(input, error);
            });
            resetPreparedEmail();

            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const message = messageInput.value.trim();
            let firstInvalidField = null;

            if (name.length < 2) {
                showFieldError(
                    nameInput,
                    nameError,
                    'Enter a name with at least two characters.',
                );
                firstInvalidField = nameInput;
            }

            if (!email) {
                showFieldError(
                    emailInput,
                    emailError,
                    'Enter your email address.',
                );
                firstInvalidField = firstInvalidField || emailInput;
            } else if (!emailInput.validity.valid) {
                showFieldError(
                    emailInput,
                    emailError,
                    'Enter an email address in the format name@example.com.',
                );
                firstInvalidField = firstInvalidField || emailInput;
            }

            if (message.length < 20) {
                showFieldError(
                    messageInput,
                    messageError,
                    'Write a message with at least 20 characters.',
                );
                firstInvalidField = firstInvalidField || messageInput;
            }

            if (firstInvalidField) {
                formStatus.textContent = 'Please correct the highlighted fields.';
                formStatus.classList.add('is-error');
                firstInvalidField.focus();
                return;
            }

            const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
            const body = encodeURIComponent(
                [`Name: ${name}`, `Email: ${email}`, '', 'Message:', message].join(
                    '\n',
                ),
            );

            emailDraftLink.href =
                `mailto:leqso.davitashvili.st@gmail.com?subject=${subject}` +
                `&body=${body}`;
            emailDraftLink.hidden = false;
            formStatus.textContent =
                'Your message is ready. Open the draft, review it, and send it from your email application.';
            formStatus.classList.add('is-success');
            emailDraftLink.focus();
        });
    }
});
