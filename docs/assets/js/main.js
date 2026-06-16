(() => {
    const broker = {
        email: "juan.delacruz@example.com",
        facebook: "https://www.facebook.com/juan.delacruz.realestate"
    };

    const fallbackImage = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 620">
            <defs>
                <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stop-color="#dceafb"/>
                    <stop offset=".58" stop-color="#f7fbff"/>
                    <stop offset="1" stop-color="#a8d2ef"/>
                </linearGradient>
            </defs>
            <rect width="900" height="620" fill="url(#sky)"/>
            <rect x="560" y="70" width="120" height="300" rx="8" fill="#9fc4e9" opacity=".85"/>
            <rect x="700" y="45" width="135" height="340" rx="8" fill="#84b4de" opacity=".9"/>
            <ellipse cx="420" cy="475" rx="340" ry="86" fill="#5eb9dd" opacity=".75"/>
            <text x="90" y="115" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#06265f">DMCI Property Image</text>
        </svg>`);

    let properties = [];
    let newsItems = [];
    let progressItems = [];
    let activeGallery = [];
    let activeImageIndex = 0;
    let activeProgressGallery = [];
    let activeProgressImageIndex = 0;
    let featuredExpanded = false;
    let cardCarouselTimer = null;
    let inquiryConfigPromise = null;

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    const getInitialLimit = () => {
        if (window.matchMedia("(max-width: 640px)").matches) return 1;
        if (window.matchMedia("(max-width: 1024px)").matches) return 2;
        if (window.matchMedia("(max-width: 1180px)").matches) return 3;
        return 4;
    };

    const uniqueImages = (images = []) => [...new Set(images.filter(Boolean))];

    const imageUrl = (item) => item.image || item.gallery?.[0] || fallbackImage;

    const readEmbeddedJson = (id) => {
        const element = document.getElementById(id);
        if (!element?.textContent?.trim()) return null;
        return JSON.parse(element.textContent);
    };

    const loadJson = async (url, embeddedId) => {
        try {
            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok) throw new Error(`${url} failed to load: ${response.status}`);
            return await response.json();
        } catch (error) {
            const embedded = readEmbeddedJson(embeddedId);
            if (embedded) return embedded;
            throw error;
        }
    };

    const loadInquiryConfig = () => {
        if (!inquiryConfigPromise) {
            inquiryConfigPromise = loadJson("config/inquiry-config.json", "inquiry-config-data")
                .then((config) => {
                    if (!config.staticFormsEndpoint || !config.apiKey || !config.receiverEmail) {
                        throw new Error("Inquiry config is missing required Static Forms values.");
                    }
                    return config;
                });
        }

        return inquiryConfigPromise;
    };

    const propertyImages = (property) => {
        const images = uniqueImages([...(property.gallery || []), property.image]);
        return images.length ? images : [fallbackImage];
    };

    const escapeAttribute = (value = "") =>
        String(value)
            .replaceAll("&", "&amp;")
            .replaceAll('"', "&quot;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");

    const renderTags = (tags = []) =>
        tags.map((tag) => `<span class="tag">${tag}</span>`).join("");

    const compactStatus = (status = "") => {
        if (!status) return "Available";
        if (status.toLowerCase().includes("confirmation")) return "For confirmation";
        return status;
    };

    const cardBadgeTags = (property) => {
        const tags = uniqueImages([...(property.category || []), property.city]).filter((tag) =>
            !String(tag).toLowerCase().includes("confirmation")
        );
        return tags.slice(0, 2);
    };

    const createInquiryHref = (property) => {
        const subject = encodeURIComponent(`Inquiry about ${property.name}`);
        const body = encodeURIComponent(property.inquiry_message || `Hi Juan, I would like to inquire about ${property.name}.`);
        return `mailto:${broker.email}?subject=${subject}&body=${body}`;
    };

    const createMessengerHref = (property) => {
        const message = encodeURIComponent(property.inquiry_message || `Hi Juan, I would like to inquire about ${property.name}.`);
        return `${broker.facebook}?mibextid=wwXIfr&message=${message}`;
    };

    const setFormStatus = (element, type, message) => {
        if (!element) return;
        element.classList.remove("success", "error");
        if (type) element.classList.add(type);
        element.textContent = message || "";
    };

    const propertyCardTemplate = (property, index) => {
        const images = propertyImages(property);
        const hasCarousel = images.length > 1;
        const badges = cardBadgeTags(property);

        return `
        <article class="property-card observe-card" style="--stagger: ${Math.min(index, 9) * 70}ms">
            <div class="card-media property-carousel" data-card-carousel="${property.id}" data-active-index="0" role="group" aria-label="${property.name} property image carousel">
                <div class="property-carousel-track">
                    ${images.map((image, imageIndex) => `
                        <img class="property-carousel-image${imageIndex === 0 ? " is-active" : ""}" src="${image}" alt="${escapeAttribute(property.name)} image ${imageIndex + 1}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'">`
                    ).join("")}
                </div>
                <div class="card-badges">
                    ${badges.map((tag) => `<span>${tag}</span>`).join("")}
                </div>
                ${hasCarousel ? `
                    <button class="card-carousel-btn prev" type="button" data-card-carousel-prev="${property.id}" aria-label="Previous ${escapeAttribute(property.name)} image">&lsaquo;</button>
                    <button class="card-carousel-btn next" type="button" data-card-carousel-next="${property.id}" aria-label="Next ${escapeAttribute(property.name)} image">&rsaquo;</button>
                    <div class="card-carousel-dots" aria-hidden="true">
                        ${images.map((_, dotIndex) => `<span class="${dotIndex === 0 ? "active" : ""}"></span>`).join("")}
                    </div>` : ""}
            </div>
            <div class="property-card-content">
                <h3>${property.name}</h3>
                <p class="location">${property.location}</p>
                <p class="units">${property.unit_types.join(" &middot; ")}</p>
                <p class="price">${property.price_range}</p>
                <p class="card-status">${compactStatus(property.status)}</p>
                <button class="btn btn-primary" type="button" data-view="${property.id}">View Details</button>
            </div>
        </article>`;
    };

    const observeCards = () => {
        const cards = $$(".observe-card");
        if (!("IntersectionObserver" in window)) {
            cards.forEach((card) => card.classList.add("is-visible"));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        cards.forEach((card) => observer.observe(card));
    };

    const setCardCarouselImage = (carousel, index) => {
        if (!carousel) return;
        const images = Array.from(carousel.querySelectorAll(".property-carousel-image"));
        if (images.length <= 1) return;

        const nextIndex = (index + images.length) % images.length;
        carousel.dataset.activeIndex = String(nextIndex);

        images.forEach((image, imageIndex) => {
            image.classList.toggle("is-active", imageIndex === nextIndex);
        });

        carousel.querySelectorAll(".card-carousel-dots span").forEach((dot, dotIndex) => {
            dot.classList.toggle("active", dotIndex === nextIndex);
        });
    };

    const moveCardCarousel = (carousel, direction) => {
        const currentIndex = Number(carousel?.dataset.activeIndex || 0);
        setCardCarouselImage(carousel, currentIndex + direction);
    };

    const startCardCarousels = () => {
        window.clearInterval(cardCarouselTimer);

        const carousels = $$("[data-card-carousel]").filter((carousel) =>
            carousel.querySelectorAll(".property-carousel-image").length > 1
        );

        if (carousels.length === 0) return;

        cardCarouselTimer = window.setInterval(() => {
            carousels.forEach((carousel) => {
                if (!carousel.isConnected || carousel.matches(":hover")) return;

                const lastManual = Number(carousel.dataset.lastManual || 0);
                if (Date.now() - lastManual < 4500) return;

                moveCardCarousel(carousel, 1);
            });
        }, 1500);
    };

    const handleCardCarouselClick = (button, direction) => {
        const carousel = button.closest("[data-card-carousel]");
        if (!carousel) return;

        carousel.dataset.lastManual = String(Date.now());
        moveCardCarousel(carousel, direction);
    };

    const updateScrollControls = () => {
        const controls = $(".scroll-controls");
        if (!controls) return;
        controls.classList.toggle("is-visible", window.scrollY > 420);
    };

    const updateSectionNavigation = () => {
        const links = $$(".section-nav-link");
        if (links.length === 0) return;

        const sections = links
            .map((link) => {
                const id = link.getAttribute("href")?.replace("#", "");
                const target = id ? document.getElementById(id) : null;
                return { id, link, target };
            })
            .filter((item) => item.target);

        const anchorLine = window.innerHeight * 0.38;
        const active = sections.reduce((current, item) => {
            const rect = item.target.getBoundingClientRect();
            if (rect.top <= anchorLine && rect.bottom >= 120) return item;
            return current;
        }, sections[0]);

        links.forEach((link) => {
            link.classList.toggle("active", link === active?.link);
        });
    };

    const getFilters = () => ({
        search: ($("#property-search")?.value || "").trim().toLowerCase(),
        location: $("#location-filter")?.value || "All",
        price: $("#price-filter")?.value || "Any",
        unit: $("#unit-filter")?.value || "Any",
        sort: $("#sort-filter")?.value || "default"
    });

    const matchesPrice = (property, priceFilter) => {
        if (priceFilter === "Any") return true;
        if (priceFilter === "under-5m") return property.price_min < 5000000;
        if (priceFilter === "5m-10m") return property.price_max >= 5000000 && property.price_min <= 10000000;
        if (priceFilter === "10m-20m") return property.price_max >= 10000000 && property.price_min <= 20000000;
        if (priceFilter === "20m-above") return property.price_max >= 20000000;
        return true;
    };

    const filteredProperties = () => {
        const filters = getFilters();

        const filtered = properties.filter((property) => {
            const haystack = [
                property.name,
                property.location,
                property.city,
                property.tags.join(" ")
            ].join(" ").toLowerCase();
            const matchesSearch = !filters.search || haystack.includes(filters.search);
            const matchesLocation = filters.location === "All" || property.city === filters.location;
            const matchesUnit = filters.unit === "Any" || property.unit_types.includes(filters.unit);

            return matchesSearch && matchesLocation && matchesUnit && matchesPrice(property, filters.price);
        });

        if (filters.sort === "price-asc") {
            filtered.sort((a, b) => a.price_min - b.price_min);
        }

        if (filters.sort === "price-desc") {
            filtered.sort((a, b) => b.price_max - a.price_max);
        }

        return filtered;
    };

    const ensureShowMoreButton = (container) => {
        let button = $("#featured-toggle");
        if (!button) {
            button = document.createElement("button");
            button.id = "featured-toggle";
            button.type = "button";
            button.className = "show-more-btn";
            button.dataset.featuredToggle = "true";
            container.insertAdjacentElement("afterend", button);
        }
        return button;
    };

    const renderFeaturedProperties = () => {
        const container = $("#featured-properties");
        if (!container) return;

        const items = filteredProperties();
        const initialLimit = getInitialLimit();
        const visible = featuredExpanded ? items : items.slice(0, initialLimit);
        const button = ensureShowMoreButton(container);

        if (visible.length === 0) {
            container.innerHTML = `<p class="empty-state">No matching properties found. Try changing the filters.</p>`;
            button.hidden = true;
            return;
        }

        container.innerHTML = visible.map(propertyCardTemplate).join("");
        button.hidden = items.length <= initialLimit;
        button.textContent = featuredExpanded ? "Show Less" : `Show More (${items.length - initialLimit})`;
        button.setAttribute("aria-expanded", String(featuredExpanded));
        observeCards();
        startCardCarousels();
    };

    const populateInterestedProperty = () => {
        const select = $("#interested-property");
        if (!select) return;

        select.innerHTML = [
            "<option value=\"\">Select property</option>",
            ...properties.map((property) => `<option value="${property.name}">${property.name}</option>`)
        ].join("");
    };

    const setImage = (index) => {
        if (activeGallery.length === 0) return;
        activeImageIndex = (index + activeGallery.length) % activeGallery.length;

        const image = $("#modal-image");
        if (image) {
            image.onerror = () => {
                image.onerror = null;
                image.src = fallbackImage;
            };
            image.src = activeGallery[activeImageIndex];
            image.alt = `Property gallery image ${activeImageIndex + 1}`;
        }

        $$(".thumb").forEach((thumb, thumbIndex) => {
            thumb.classList.toggle("active", thumbIndex === activeImageIndex);
        });
    };

    const renderListItems = (selector, values) => {
        const list = $(selector);
        if (!list) return;
        list.innerHTML = values.map((value) => `<li>${value}</li>`).join("");
    };

    const openModal = (property) => {
        activeGallery = property.gallery?.length ? property.gallery : [property.image || fallbackImage];
        activeImageIndex = 0;

        $("#modal-location").textContent = property.location;
        $("#modal-title").textContent = property.name;
        $("#modal-tags").innerHTML = renderTags(property.tags);
        $("#modal-gallery-title").textContent = property.name;
        $("#modal-gallery-location").textContent = property.location;
        $("#modal-gallery-tags").innerHTML = renderTags(property.tags);
        $("#modal-price").textContent = property.price_range;
        $("#modal-units").textContent = property.unit_types.join(", ");
        $("#modal-turnover").textContent = property.turnover;
        $("#modal-status").textContent = property.status;
        $("#modal-description").textContent = property.description;
        $("#modal-payment").textContent = property.payment_terms || "Flexible payment options available upon request";
        $("#modal-inquire").href = createInquiryHref(property);
        $("#modal-message").href = createMessengerHref(property);

        renderListItems("#modal-features", property.features);
        renderListItems("#modal-amenities", property.amenities);

        $("#thumbnail-row").innerHTML = activeGallery
            .map((imagePath, index) => `<button class="thumb" type="button" data-thumb="${index}" aria-label="Show image ${index + 1}" title="${imagePath}"><img src="${imagePath}" alt="" onerror="this.onerror=null;this.src='${fallbackImage}'"></button>`)
            .join("");

        setImage(0);
        $("#property-modal").classList.add("is-open");
        $("#property-modal").setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-lock");
    };

    const closeModal = () => {
        $("#property-modal")?.classList.remove("is-open");
        $("#property-modal")?.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-lock");
    };

    const openNewsModal = (item) => {
        const modal = $("#news-modal");
        if (!modal || !item) return;

        const image = $("#news-modal-image");
        if (image) {
            image.onerror = () => {
                image.onerror = null;
                image.src = fallbackImage;
            };
            image.src = imageUrl(item);
            image.alt = item.title;
        }

        $("#news-modal-category").textContent = item.category;
        $("#news-modal-date").textContent = item.date;
        $("#news-modal-title").textContent = item.title;
        $("#news-modal-description").textContent = item.description;

        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-lock");
    };

    const closeNewsModal = () => {
        $("#news-modal")?.classList.remove("is-open");
        $("#news-modal")?.setAttribute("aria-hidden", "true");
        if (!$("#property-modal")?.classList.contains("is-open")) {
            document.body.classList.remove("modal-lock");
        }
    };

    const findPropertyForProgress = (item) =>
        properties.find((property) => property.name.toLowerCase() === item.property_name.toLowerCase());

    const setProgressImage = (index) => {
        if (activeProgressGallery.length === 0) return;
        activeProgressImageIndex = (index + activeProgressGallery.length) % activeProgressGallery.length;

        const image = $("#progress-modal-image");
        if (image) {
            image.onerror = () => {
                image.onerror = null;
                image.src = fallbackImage;
            };
            image.src = activeProgressGallery[activeProgressImageIndex];
            image.alt = `Construction update image ${activeProgressImageIndex + 1}`;
        }

        $$(".progress-thumb").forEach((thumb, thumbIndex) => {
            thumb.classList.toggle("active", thumbIndex === activeProgressImageIndex);
        });
    };

    const openProgressModal = (item) => {
        const modal = $("#progress-modal");
        if (!modal || !item) return;

        const property = findPropertyForProgress(item);
        activeProgressGallery = uniqueImages([
            item.image,
            ...(property?.gallery || []),
            property?.image
        ]);
        if (activeProgressGallery.length === 0) activeProgressGallery = [fallbackImage];
        activeProgressImageIndex = 0;

        const percentText = `${item.progress_percentage}% Complete`;
        $("#progress-modal-percent").textContent = percentText;
        $("#progress-modal-status").textContent = item.status;
        $("#progress-modal-date").textContent = `Updated ${item.last_updated}`;
        $("#progress-modal-title").textContent = item.property_name;
        $("#progress-modal-location").textContent = item.location;
        $("#progress-modal-bar").style.width = `${item.progress_percentage}%`;
        $("#progress-modal-fact-progress").textContent = percentText;
        $("#progress-modal-price").textContent = property?.price_range || "For confirmation";
        $("#progress-modal-units").textContent = property?.unit_types?.join(" · ") || "For confirmation";
        $("#progress-modal-turnover").textContent = property?.turnover || "For confirmation";
        $("#progress-modal-description").textContent = property?.description || `${item.property_name} is a featured DMCI Homes community. Ask for the latest confirmed construction details, availability, and viewing guidance.`;

        const highlights = property?.features?.length
            ? property.features.slice(0, 4)
            : ["Construction update available upon request", "Latest availability subject to confirmation", "Broker can help verify project details"];
        $("#progress-modal-highlights").innerHTML = highlights.map((highlight) => `<li>${highlight}</li>`).join("");
        $("#progress-thumbnail-row").innerHTML = activeProgressGallery
            .map((imagePath, index) => `<button class="thumb progress-thumb" type="button" data-progress-thumb="${index}" aria-label="Show construction image ${index + 1}" title="${imagePath}"><img src="${imagePath}" alt="" onerror="this.onerror=null;this.src='${fallbackImage}'"></button>`)
            .join("");
        setProgressImage(0);

        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-lock");
    };

    const closeProgressModal = () => {
        $("#progress-modal")?.classList.remove("is-open");
        $("#progress-modal")?.setAttribute("aria-hidden", "true");
        if (!$("#property-modal")?.classList.contains("is-open") && !$("#news-modal")?.classList.contains("is-open")) {
            document.body.classList.remove("modal-lock");
        }
    };

    const openThankYouModal = () => {
        const modal = $("#thank-you-modal");
        if (!modal) return;
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-lock");
    };

    const closeThankYouModal = () => {
        $("#thank-you-modal")?.classList.remove("is-open");
        $("#thank-you-modal")?.setAttribute("aria-hidden", "true");
        if (
            !$("#property-modal")?.classList.contains("is-open") &&
            !$("#news-modal")?.classList.contains("is-open") &&
            !$("#progress-modal")?.classList.contains("is-open")
        ) {
            document.body.classList.remove("modal-lock");
        }
    };

    const renderNews = async () => {
        const container = $("#news-grid");
        if (!container) return;

        try {
            newsItems = await loadJson("data/news.json", "news-data");
            container.innerHTML = newsItems.map((item, index) => `
                <article class="news-card observe-card" style="--stagger: ${index * 80}ms">
                    <img src="${imageUrl(item)}" alt="${item.title}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'">
                    <div>
                        <div class="card-meta">
                            <span class="tag">${item.category}</span>
                            <time>${item.date}</time>
                        </div>
                        <h3>${item.title}</h3>
                        <p>${item.description}</p>
                        <button class="btn btn-secondary" type="button" data-news="${item.id}">Read More</button>
                    </div>
                </article>`).join("");
            observeCards();
        } catch (error) {
            console.error(error);
            container.innerHTML = `<p class="empty-state">Updates are currently unavailable.</p>`;
        }
    };

    const renderProgress = async () => {
        const container = $("#progress-grid");
        if (!container) return;

        try {
            progressItems = await loadJson("data/site-progress.json", "site-progress-data");
            container.innerHTML = progressItems.map((item, index) => `
                <article class="progress-card observe-card" style="--stagger: ${index * 80}ms">
                    <img src="${imageUrl(item)}" alt="${item.property_name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'">
                    <div>
                        <div class="card-meta">
                            <span class="tag green">Construction Update</span>
                            <time>${item.last_updated}</time>
                        </div>
                        <h3>${item.property_name}</h3>
                        <p>${item.location}</p>
                        <strong class="progress-value">${item.progress_percentage}% Complete</strong>
                        <div class="progress-track"><span style="width: ${item.progress_percentage}%"></span></div>
                        <p>${item.status}</p>
                        <button class="btn btn-secondary" type="button" data-progress="${item.id}">View Progress</button>
                    </div>
                </article>`).join("");
            observeCards();
        } catch (error) {
            console.error(error);
            container.innerHTML = `<p class="empty-state">Progress updates are currently unavailable.</p>`;
        }
    };

    const bindEvents = () => {
        $(".menu-toggle")?.addEventListener("click", () => {
            const header = $(".site-header");
            const isOpen = header.classList.toggle("nav-open");
            $(".menu-toggle").setAttribute("aria-expanded", String(isOpen));
        });

        $$(".scroll-controls [data-scroll]").forEach((button) => {
            button.addEventListener("click", () => {
                const target = button.dataset.scroll === "top" ? $("#home") : $("#properties");
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        });

        $$(".section-nav-link").forEach((link) => {
            link.addEventListener("click", () => {
                $$(".section-nav-link").forEach((item) => item.classList.remove("active"));
                link.classList.add("active");
            });
        });

        $("#property-filter-toggle")?.addEventListener("click", (event) => {
            const button = event.currentTarget;
            const panel = $("#property-filter-panel");
            if (!panel) return;

            const isOpening = panel.hidden;
            panel.hidden = !isOpening;
            panel.classList.toggle("is-open", isOpening);
            button.setAttribute("aria-expanded", String(isOpening));
            button.querySelector("span").textContent = isOpening ? "Hide Filters" : "Show Filters";
        });

        window.addEventListener("scroll", () => {
            updateScrollControls();
            updateSectionNavigation();
        }, { passive: true });

        ["#property-search", "#location-filter", "#price-filter", "#unit-filter", "#sort-filter"].forEach((selector) => {
            $(selector)?.addEventListener("input", () => {
                featuredExpanded = false;
                renderFeaturedProperties();
            });
            $(selector)?.addEventListener("change", () => {
                featuredExpanded = false;
                renderFeaturedProperties();
            });
        });

        window.addEventListener("resize", () => {
            window.clearTimeout(window.__propertyResizeTimer);
            window.__propertyResizeTimer = window.setTimeout(renderFeaturedProperties, 180);
        });

        document.addEventListener("click", (event) => {
            const previousCardImage = event.target.closest("[data-card-carousel-prev]");
            if (previousCardImage) {
                handleCardCarouselClick(previousCardImage, -1);
                return;
            }

            const nextCardImage = event.target.closest("[data-card-carousel-next]");
            if (nextCardImage) {
                handleCardCarouselClick(nextCardImage, 1);
                return;
            }

            const viewButton = event.target.closest("[data-view]");
            if (viewButton) {
                const property = properties.find((item) => item.id === viewButton.dataset.view);
                if (property) openModal(property);
            }

            const thumb = event.target.closest("[data-thumb]");
            if (thumb) setImage(Number(thumb.dataset.thumb));

            const progressThumb = event.target.closest("[data-progress-thumb]");
            if (progressThumb) setProgressImage(Number(progressThumb.dataset.progressThumb));

            const featuredToggle = event.target.closest("[data-featured-toggle]");
            if (featuredToggle) {
                featuredExpanded = !featuredExpanded;
                renderFeaturedProperties();
            }

            const newsButton = event.target.closest("[data-news]");
            if (newsButton) {
                const item = newsItems.find((news) => news.id === newsButton.dataset.news);
                if (item) openNewsModal(item);
            }

            const progressButton = event.target.closest("[data-progress]");
            if (progressButton) {
                const item = progressItems.find((progress) => progress.id === progressButton.dataset.progress);
                if (item) openProgressModal(item);
            }
        });

        $(".modal-close")?.addEventListener("click", closeModal);
        $("#property-modal")?.addEventListener("click", (event) => {
            if (event.target.id === "property-modal") closeModal();
        });
        $$(".news-modal-close").forEach((button) => {
            button.addEventListener("click", closeNewsModal);
        });
        $("#news-modal")?.addEventListener("click", (event) => {
            if (event.target.id === "news-modal") closeNewsModal();
        });
        $$(".progress-modal-close").forEach((button) => {
            button.addEventListener("click", closeProgressModal);
        });
        $("#progress-modal")?.addEventListener("click", (event) => {
            if (event.target.id === "progress-modal") closeProgressModal();
        });
        $$(".thank-you-modal-close").forEach((button) => {
            button.addEventListener("click", closeThankYouModal);
        });
        $("#thank-you-modal")?.addEventListener("click", (event) => {
            if (event.target.id === "thank-you-modal") closeThankYouModal();
        });
        $("#property-modal .gallery-btn.prev")?.addEventListener("click", () => setImage(activeImageIndex - 1));
        $("#property-modal .gallery-btn.next")?.addEventListener("click", () => setImage(activeImageIndex + 1));
        $(".progress-gallery-btn.prev")?.addEventListener("click", () => setProgressImage(activeProgressImageIndex - 1));
        $(".progress-gallery-btn.next")?.addEventListener("click", () => setProgressImage(activeProgressImageIndex + 1));

        document.addEventListener("keydown", (event) => {
            const propertyOpen = $("#property-modal")?.classList.contains("is-open");
            const newsOpen = $("#news-modal")?.classList.contains("is-open");
            const progressOpen = $("#progress-modal")?.classList.contains("is-open");
            const thankYouOpen = $("#thank-you-modal")?.classList.contains("is-open");
            if (!propertyOpen && !newsOpen && !progressOpen && !thankYouOpen) return;
            if (event.key === "Escape") {
                closeModal();
                closeNewsModal();
                closeProgressModal();
                closeThankYouModal();
            }
            if (progressOpen && event.key === "ArrowLeft") setProgressImage(activeProgressImageIndex - 1);
            if (progressOpen && event.key === "ArrowRight") setProgressImage(activeProgressImageIndex + 1);
            if (!propertyOpen) return;
            if (event.key === "ArrowLeft") setImage(activeImageIndex - 1);
            if (event.key === "ArrowRight") setImage(activeImageIndex + 1);
        });

        $(".inquiry-form")?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            const success = $("#form-success");
            const submitButton = form.querySelector("button[type='submit']");
            const submitLabel = submitButton?.dataset.submitLabel || "Submit Inquiry";

            if (form.dataset.submitting === "true") return;
            setFormStatus(success, "", "");

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            if (String(formData.get("honeypot") || "").trim()) {
                form.reset();
                return;
            }

            form.dataset.submitting = "true";
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Sending...";
            }
            form.classList.add("is-submitting");

            try {
                const property = String(formData.get("property") || "").trim();
                const message = String(formData.get("message") || "").trim();
                const phone = String(formData.get("phone") || "").trim();

                formData.set("message", [
                    `Interested Property: ${property}`,
                    `Phone Number: ${phone}`,
                    "",
                    message
                ].join("\n"));

                const response = await fetch(form.action, {
                    method: form.method || "POST",
                    headers: {
                        "Accept": "application/json"
                    },
                    body: formData
                });
                const result = await response.json().catch(() => ({}));

                if (!response.ok || result.success === false) {
                    throw new Error(result.message || "The inquiry could not be sent.");
                }

                form.reset();
                if (submitButton) submitButton.textContent = "Sent";
                openThankYouModal();
            } catch (error) {
                console.error(error);
                setFormStatus(success, "error", "Something went wrong. Please try again.");
                delete form.dataset.submitting;
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = submitLabel;
                }
            } finally {
                form.classList.remove("is-submitting");
            }
        });
    };

    const init = async () => {
        bindEvents();

        try {
            properties = await loadJson("data/properties.json", "properties-data");
            renderFeaturedProperties();
            populateInterestedProperty();
            await Promise.all([renderNews(), renderProgress()]);
            updateScrollControls();
            updateSectionNavigation();
        } catch (error) {
            console.error(error);
            const container = $("#featured-properties");
            if (container) container.innerHTML = `<p class="empty-state">Property listings are temporarily unavailable.</p>`;
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
