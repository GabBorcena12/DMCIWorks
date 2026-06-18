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
    let featuredVisibleCount = null;
    let newsVisibleCount = null;
    let progressVisibleCount = null;
    let isFeaturedToggleLoading = false;
    let isNewsToggleLoading = false;
    let isProgressToggleLoading = false;
    let cardCarouselTimer = null;
    let modalCarouselTimer = null;
    let progressModalCarouselTimer = null;
    let inquiryConfigPromise = null;

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));

    const modalScrollSelectors = [
        ".modal-body",
        ".modal-content",
        ".modal-details",
        ".modal-left",
        ".modal-right",
        ".modal-panel",
        ".modal-gallery",
        ".news-modal-panel",
        ".news-modal-content",
        ".progress-modal-panel",
        ".progress-modal-media",
        ".progress-modal-content",
        "[data-modal-scroll]"
    ].join(", ");

    const resetModalScroll = (modal) => {
        if (!modal) return;

        const reset = () => {
            [modal, ...modal.querySelectorAll(modalScrollSelectors)].forEach((element) => {
                element.scrollTop = 0;
                element.scrollLeft = 0;
            });
        };

        reset();
        window.requestAnimationFrame(() => {
            reset();
            window.requestAnimationFrame(reset);
        });
    };

    const syncModalLock = () => {
        document.body.classList.toggle("modal-lock", Boolean($(".modal.is-open")));
    };

    const showModal = (modal) => {
        if (!modal) return;
        resetModalScroll(modal);
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        syncModalLock();
        resetModalScroll(modal);
    };

    const hideModal = (modal) => {
        if (!modal) return;
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        resetModalScroll(modal);
        syncModalLock();
    };

    const getInitialLimit = () => {
        if (window.matchMedia("(max-width: 640px)").matches) return 1;
        if (window.matchMedia("(max-width: 1024px)").matches) return 2;
        if (window.matchMedia("(max-width: 1180px)").matches) return 3;
        return 4;
    };

    const getShowMoreStep = () => getInitialLimit() * 2;

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

    const inferSellingStatus = (property) => {
        const source = [
            property.selling_status,
            property.status,
            property.turnover,
            property.turnover_date,
            ...(property.category || [])
        ].filter(Boolean).join(" ").toLowerCase();

        if (property.is_rfo || source.includes("ready for occupancy") || source.includes("rfo")) return "RFO";
        if (property.is_preselling || source.includes("preselling") || source.includes("pre-selling") || source.includes("under construction") || source.includes("new")) return "Preselling";
        return property.selling_status || property.status || "For confirmation";
    };

    const normalizeProperty = (property) => {
        const sellingStatus = inferSellingStatus(property);
        const turnoverDate = property.turnover_date || property.turnover || "For confirmation";

        return {
            ...property,
            selling_status: sellingStatus,
            is_rfo: Boolean(property.is_rfo || sellingStatus === "RFO"),
            is_preselling: Boolean(property.is_preselling || sellingStatus === "Preselling"),
            turnover_date: turnoverDate,
            turnover_date_source: property.turnover_date_source || ""
        };
    };

    const normalizeProperties = (items = []) => items.map(normalizeProperty);

    const getTurnoverDate = (property) => property.turnover_date || property.turnover || "For confirmation";

    const getSellingStatusClass = (property) => {
        const status = inferSellingStatus(property).toLowerCase();
        if (property.is_rfo || status === "rfo") return "is-rfo";
        if (property.is_preselling || status === "preselling") return "is-preselling";
        return "is-confirmation";
    };

    const hasProgressPercentage = (item) =>
        item.progress_percentage !== null &&
        item.progress_percentage !== undefined &&
        item.progress_percentage !== "";

    const getProgressDisplay = (item) =>
        hasProgressPercentage(item)
            ? (item.progress_display || `${item.progress_percentage}%`)
            : "Not yet available";

    const getProgressText = (item) =>
        hasProgressPercentage(item)
            ? `${getProgressDisplay(item)} Complete`
            : "Not yet available";

    const getProgressWidth = (item) =>
        hasProgressPercentage(item) ? `${item.progress_percentage}%` : "0%";

    const formatDisplayDate = (value) => {
        if (!value || String(value).toLowerCase().includes("not")) return value || "Not yet available";
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });
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
        <article class="property-card observe-card" style="--stagger: ${Math.min(index, 9) * 40}ms">
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
                <span class="selling-status-badge ${getSellingStatusClass(property)}">${inferSellingStatus(property)}</span>
                <h3>${property.name}</h3>
                <p class="location">${property.location}</p>
                <p class="units">${property.unit_types.join(" &middot; ")}</p>
                <p class="price">${property.price_range}</p>
                <p class="turnover-info">Turnover: ${getTurnoverDate(property)}</p>
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
                if (!carousel.isConnected || !carousel.matches(":hover")) return;

                const lastManual = Number(carousel.dataset.lastManual || 0);
                if (Date.now() - lastManual < 4500) return;

                moveCardCarousel(carousel, 1);
            });
        }, 2500);
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
        sellingStatus: $("#selling-status-filter")?.value || "All",
        sort: $("#sort-filter")?.value || "default"
    });

    const populatePropertyFilters = () => {
        const locationSelect = $("#location-filter");
        const unitSelect = $("#unit-filter");

        if (locationSelect) {
            const locations = [...new Set(properties.map((property) => property.city).filter(Boolean))].sort();
            locationSelect.innerHTML = [
                "<option value=\"All\">All Locations</option>",
                ...locations.map((location) => `<option value="${location}">${location}</option>`)
            ].join("");
        }

        if (unitSelect) {
            const units = [...new Set(properties.flatMap((property) => property.unit_types || []).filter(Boolean))].sort();
            unitSelect.innerHTML = [
                "<option value=\"Any\">Any Unit</option>",
                ...units.map((unit) => `<option value="${unit}">${unit}</option>`)
            ].join("");
        }
    };

    const resetPropertyFilters = () => {
        const search = $("#property-search");
        const location = $("#location-filter");
        const price = $("#price-filter");
        const unit = $("#unit-filter");
        const sellingStatus = $("#selling-status-filter");
        const sort = $("#sort-filter");

        if (search) search.value = "";
        if (location) location.value = "All";
        if (price) price.value = "Any";
        if (unit) unit.value = "Any";
        if (sellingStatus) sellingStatus.value = "All";
        if (sort) sort.value = "default";

        featuredVisibleCount = null;
        renderFeaturedProperties();
    };

    const matchesPrice = (property, priceFilter) => {
        if (priceFilter === "Any") return true;
        if (priceFilter === "under-5m") return property.price_min < 5000000;
        if (priceFilter === "5m-10m") return property.price_max >= 5000000 && property.price_min <= 10000000;
        if (priceFilter === "10m-20m") return property.price_max >= 10000000 && property.price_min <= 20000000;
        if (priceFilter === "20m-above") return property.price_max >= 20000000;
        return true;
    };

    const matchesSellingStatus = (property, statusFilter) => {
        if (statusFilter === "All") return true;
        if (statusFilter === "RFO") return Boolean(property.is_rfo);
        if (statusFilter === "Preselling") return Boolean(property.is_preselling);
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
            const matchesStatus = matchesSellingStatus(property, filters.sellingStatus);

            return matchesSearch && matchesLocation && matchesUnit && matchesStatus && matchesPrice(property, filters.price);
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

    const renderPropertySkeletons = () => {
        const container = $("#featured-properties");
        if (!container) return;

        const count = getInitialLimit();
        const button = ensureShowMoreButton(container);
        button.hidden = true;
        container.classList.add("is-loading");
        container.setAttribute("aria-busy", "true");
        container.innerHTML = Array.from({ length: count }, (_, index) => `
            <article class="property-card property-card-skeleton" aria-hidden="true" style="--stagger: ${index * 40}ms">
                <div class="card-media skeleton-media"></div>
                <div class="property-card-content">
                    <span class="skeleton-line skeleton-badge"></span>
                    <span class="skeleton-line skeleton-title"></span>
                    <span class="skeleton-line"></span>
                    <span class="skeleton-line short"></span>
                    <span class="skeleton-line medium"></span>
                    <span class="skeleton-button"></span>
                </div>
            </article>`).join("");
    };

    const renderProgressSkeletons = () => {
        const container = $("#progress-grid");
        if (!container) return;

        const count = getInitialLimit();
        const button = ensureProgressToggleButton(container);
        button.hidden = true;
        container.classList.add("is-loading");
        container.setAttribute("aria-busy", "true");
        container.innerHTML = Array.from({ length: count }, (_, index) => `
            <article class="progress-card progress-card-skeleton" aria-hidden="true" style="--stagger: ${index * 40}ms">
                <span class="skeleton-media"></span>
                <div>
                    <span class="skeleton-line skeleton-badge"></span>
                    <span class="skeleton-line skeleton-title"></span>
                    <span class="skeleton-line short"></span>
                    <span class="skeleton-line medium"></span>
                    <span class="skeleton-button"></span>
                </div>
            </article>`).join("");
    };

    const updateFeaturedToggleButton = (button, items, initialLimit, isLoading = false) => {
        if (!button) return;

        button.hidden = items.length <= initialLimit;
        button.disabled = isLoading;
        button.classList.toggle("is-loading", isLoading);
        button.setAttribute("aria-busy", String(isLoading));
        button.setAttribute("aria-expanded", String(featuredVisibleCount >= items.length));

        if (isLoading) {
            button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>Loading...</span>`;
            return;
        }

        button.textContent = featuredVisibleCount >= items.length
            ? "Show Less"
            : `Show More (${items.length - featuredVisibleCount})`;
    };

    const ensureProgressToggleButton = (container) => {
        let button = $("#progress-toggle");
        if (!button) {
            button = document.createElement("button");
            button.id = "progress-toggle";
            button.type = "button";
            button.className = "show-more-btn";
            button.dataset.progressToggle = "true";
            container.insertAdjacentElement("afterend", button);
        }
        return button;
    };

    const updateProgressToggleButton = (button, items, initialLimit, isLoading = false) => {
        if (!button) return;

        button.hidden = items.length <= initialLimit;
        button.disabled = isLoading;
        button.classList.toggle("is-loading", isLoading);
        button.setAttribute("aria-busy", String(isLoading));
        button.setAttribute("aria-expanded", String(progressVisibleCount >= items.length));

        if (isLoading) {
            button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>Loading...</span>`;
            return;
        }

        button.textContent = progressVisibleCount >= items.length
            ? "Show Less"
            : `Show More (${items.length - progressVisibleCount})`;
    };

    const renderFeaturedProperties = (options = {}) => {
        const container = $("#featured-properties");
        if (!container) return;
        container.classList.remove("is-loading");
        container.setAttribute("aria-busy", "false");

        const items = filteredProperties();
        const initialLimit = getInitialLimit();
        featuredVisibleCount = Math.min(
            Math.max(featuredVisibleCount || initialLimit, initialLimit),
            items.length
        );

        const visible = items.slice(0, featuredVisibleCount);
        const button = ensureShowMoreButton(container);

        if (visible.length === 0) {
            container.innerHTML = `
                <p class="empty-state">
                    <strong>No matching properties found.</strong>
                    <span>Try clearing the filters or adjusting location, unit type, price, or selling status.</span>
                </p>`;
            button.hidden = true;
            return;
        }

        const appendFrom = Number(options.appendFrom || 0);
        const shouldAppend = appendFrom > 0 && appendFrom < visible.length && container.children.length >= appendFrom;

        if (shouldAppend) {
            container.insertAdjacentHTML(
                "beforeend",
                visible.slice(appendFrom).map((property, index) => propertyCardTemplate(property, index)).join("")
            );
        } else {
            container.innerHTML = visible.map(propertyCardTemplate).join("");
        }

        updateFeaturedToggleButton(button, items, initialLimit, false);
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

    const stopModalCarousel = () => {
        if (modalCarouselTimer) {
            window.clearInterval(modalCarouselTimer);
            modalCarouselTimer = null;
        }
    };

    const startModalCarousel = () => {
        stopModalCarousel();
        if (activeGallery.length <= 1) return;

        modalCarouselTimer = window.setInterval(() => {
            if (!$("#property-modal")?.classList.contains("is-open")) {
                stopModalCarousel();
                return;
            }

            setImage(activeImageIndex + 1);
        }, 2500);
    };

    const renderListItems = (selector, values) => {
        const list = $(selector);
        if (!list) return;
        list.innerHTML = values.map((value) => `<li>${value}</li>`).join("");
    };

    const openModal = (property) => {
        activeGallery = property.gallery?.length ? property.gallery : [property.image || fallbackImage];
        activeImageIndex = 0;

        $("#modal-gallery-title").textContent = property.name;
        $("#modal-gallery-location").textContent = property.location;
        $("#modal-gallery-tags").innerHTML = renderTags(property.tags);
        $("#modal-price").textContent = property.price_range;
        $("#modal-units").textContent = property.unit_types.join(", ");
        $("#modal-turnover").textContent = getTurnoverDate(property);
        $("#modal-status").textContent = inferSellingStatus(property);
        $("#modal-turnover-source").textContent = property.turnover_date_source || "";
        $("#modal-turnover-source").hidden = !property.turnover_date_source;
        $("#modal-description").textContent = property.description;
        $("#modal-payment").textContent = property.payment_terms || "Flexible payment options available upon request";
        $("#modal-inquire").href = createInquiryHref(property);
        $("#modal-message").href = createMessengerHref(property);

        renderListItems("#modal-features", property.features);
        renderListItems("#modal-amenities", property.amenities);

        const thumbnailPlaceholders = Array.from({ length: Math.max(0, 4 - activeGallery.length) }, () =>
            `<span class="thumb thumb-placeholder" aria-hidden="true"><span class="thumb-placeholder-icon"></span><span>No photo yet</span></span>`
        );

        $("#thumbnail-row").innerHTML = [
            ...activeGallery.map((imagePath, index) => `<button class="thumb" type="button" data-thumb="${index}" aria-label="Show image ${index + 1}" title="${imagePath}"><img src="${imagePath}" alt="" onerror="this.onerror=null;this.src='${fallbackImage}'"></button>`),
            ...thumbnailPlaceholders
        ].join("");

        setImage(0);
        showModal($("#property-modal"));
        startModalCarousel();
    };

    const closeModal = () => {
        stopModalCarousel();
        hideModal($("#property-modal"));
        activeGallery = [];
        activeImageIndex = 0;
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

        const newsCategory = $("#news-modal-category");
        const newsDate = $("#news-modal-date");
        if (newsCategory) newsCategory.textContent = item.category;
        if (newsDate) newsDate.textContent = item.date;
        $("#news-modal-title").textContent = item.title;
        $("#news-modal-description").textContent = item.description;

        showModal(modal);
    };

    const closeNewsModal = () => {
        hideModal($("#news-modal"));
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

    const stopProgressModalCarousel = () => {
        if (progressModalCarouselTimer) {
            window.clearInterval(progressModalCarouselTimer);
            progressModalCarouselTimer = null;
        }
    };

    const startProgressModalCarousel = () => {
        stopProgressModalCarousel();
        if (activeProgressGallery.length <= 1) return;

        progressModalCarouselTimer = window.setInterval(() => {
            if (!$("#progress-modal")?.classList.contains("is-open")) {
                stopProgressModalCarousel();
                return;
            }

            setProgressImage(activeProgressImageIndex + 1);
        }, 2500);
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

        const percentText = getProgressText(item);
        $("#progress-modal-percent").textContent = percentText;
        const progressStatus = $("#progress-modal-status");
        const progressDate = $("#progress-modal-date");
        if (progressStatus) progressStatus.textContent = item.status;
        if (progressDate) progressDate.textContent = `Updated ${formatDisplayDate(item.last_updated)}`;
        $("#progress-modal-title").textContent = item.property_name;
        $("#progress-modal-location").textContent = item.location;
        $("#progress-modal-bar").style.width = getProgressWidth(item);
        $("#progress-modal-fact-progress").textContent = percentText;
        $("#progress-modal-price").textContent = property?.price_range || "For confirmation";
        $("#progress-modal-units").textContent = property?.unit_types?.join(" · ") || "For confirmation";
        $("#progress-modal-turnover").textContent = property ? getTurnoverDate(property) : "For confirmation";
        $("#progress-modal-description").textContent = property?.description || `${item.property_name} is a featured DMCI Homes community. Ask for the latest confirmed construction details, availability, and viewing guidance.`;

        const highlights = property?.features?.length
            ? property.features.slice(0, 4)
            : ["Construction update available upon request", "Latest availability subject to confirmation", "Broker can help verify project details"];
        $("#progress-modal-highlights").innerHTML = highlights.map((highlight) => `<li>${highlight}</li>`).join("");
        $("#progress-thumbnail-row").innerHTML = activeProgressGallery
            .map((imagePath, index) => `<button class="thumb progress-thumb" type="button" data-progress-thumb="${index}" aria-label="Show construction image ${index + 1}" title="${imagePath}"><img src="${imagePath}" alt="" onerror="this.onerror=null;this.src='${fallbackImage}'"></button>`)
            .join("");
        setProgressImage(0);

        showModal(modal);
        startProgressModalCarousel();
    };

    const closeProgressModal = () => {
        stopProgressModalCarousel();
        hideModal($("#progress-modal"));
        activeProgressGallery = [];
        activeProgressImageIndex = 0;
    };

    const openThankYouModal = () => {
        const modal = $("#thank-you-modal");
        if (!modal) return;
        showModal(modal);
    };

    const closeThankYouModal = () => {
        hideModal($("#thank-you-modal"));
    };

    const ensureNewsToggleButton = (container) => {
        let button = $("#news-toggle");
        if (!button) {
            button = document.createElement("button");
            button.id = "news-toggle";
            button.type = "button";
            button.className = "show-more-btn";
            button.dataset.newsToggle = "true";
            container.insertAdjacentElement("afterend", button);
        }
        return button;
    };

    const updateNewsToggleButton = (button, initialLimit, isLoading = false) => {
        if (!button) return;

        button.hidden = newsItems.length <= initialLimit;
        button.disabled = isLoading;
        button.classList.toggle("is-loading", isLoading);
        button.setAttribute("aria-busy", String(isLoading));
        button.setAttribute("aria-expanded", String(newsVisibleCount >= newsItems.length));

        if (isLoading) {
            button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>Loading...</span>`;
            return;
        }

        button.textContent = newsVisibleCount >= newsItems.length
            ? "Show Less"
            : `Show More (${newsItems.length - newsVisibleCount})`;
    };

    const newsCardTemplate = (item, index) => `
        <article class="news-card observe-card" style="--stagger: ${index * 40}ms">
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
        </article>`;

    const renderNews = async (options = {}) => {
        const container = $("#news-grid");
        if (!container) return;

        try {
            if (newsItems.length === 0) {
                newsItems = await loadJson("data/news.json", "news-data");
            }

            const initialLimit = getInitialLimit();
            newsVisibleCount = Math.min(
                Math.max(newsVisibleCount || initialLimit, initialLimit),
                newsItems.length
            );

            const visible = newsItems.slice(0, newsVisibleCount);
            const button = ensureNewsToggleButton(container);

            if (visible.length === 0) {
                container.innerHTML = `<p class="empty-state">Updates are currently unavailable.</p>`;
                button.hidden = true;
                return;
            }

            const appendFrom = Number(options.appendFrom || 0);
            const shouldAppend = appendFrom > 0 && appendFrom < visible.length && container.children.length >= appendFrom;

            if (shouldAppend) {
                container.insertAdjacentHTML(
                    "beforeend",
                    visible.slice(appendFrom).map(newsCardTemplate).join("")
                );
            } else {
                container.innerHTML = visible.map(newsCardTemplate).join("");
            }

            updateNewsToggleButton(button, initialLimit, false);
            observeCards();
        } catch (error) {
            console.error(error);
            container.innerHTML = `<p class="empty-state">Updates are currently unavailable.</p>`;
            const button = $("#news-toggle");
            if (button) button.hidden = true;
        }
    };

    const progressCardTemplate = (item, index) => `
        <article class="progress-card observe-card" style="--stagger: ${index * 40}ms">
            <img src="${imageUrl(item)}" alt="${item.property_name}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'">
            <div>
                <div class="card-meta">
                    <span class="tag green">Construction Update</span>
                            <time>${formatDisplayDate(item.last_updated)}</time>
                </div>
                <h3>${item.property_name}</h3>
                <p>${item.location}</p>
                <strong class="progress-value">${getProgressText(item)}</strong>
                <div class="progress-track"><span style="width: ${getProgressWidth(item)}"></span></div>
                <p>${item.status}</p>
                <button class="btn btn-secondary" type="button" data-progress="${item.id}">View Progress</button>
            </div>
        </article>`;

    const renderProgress = async (options = {}) => {
        const container = $("#progress-grid");
        if (!container) return;

        try {
            if (progressItems.length === 0) {
                renderProgressSkeletons();
                progressItems = await loadJson("data/site-progress.json", "site-progress-data");
            }

            container.classList.remove("is-loading");
            container.setAttribute("aria-busy", "false");

            const initialLimit = getInitialLimit();
            progressVisibleCount = Math.min(
                Math.max(progressVisibleCount || initialLimit, initialLimit),
                progressItems.length
            );

            const visible = progressItems.slice(0, progressVisibleCount);
            const button = ensureProgressToggleButton(container);

            if (visible.length === 0) {
                container.innerHTML = `<p class="empty-state">Progress updates are currently unavailable.</p>`;
                button.hidden = true;
                return;
            }

            const appendFrom = Number(options.appendFrom || 0);
            const shouldAppend = appendFrom > 0 && appendFrom < visible.length && container.children.length >= appendFrom;

            if (shouldAppend) {
                container.insertAdjacentHTML(
                    "beforeend",
                    visible.slice(appendFrom).map((item, index) => progressCardTemplate(item, index)).join("")
                );
            } else {
                container.innerHTML = visible.map(progressCardTemplate).join("");
            }

            updateProgressToggleButton(button, progressItems, initialLimit, false);
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

        ["#property-search", "#location-filter", "#price-filter", "#unit-filter", "#selling-status-filter", "#sort-filter"].forEach((selector) => {
            $(selector)?.addEventListener("input", () => {
                featuredVisibleCount = null;
                renderFeaturedProperties();
            });
            $(selector)?.addEventListener("change", () => {
                featuredVisibleCount = null;
                renderFeaturedProperties();
            });
        });

        window.addEventListener("resize", () => {
            window.clearTimeout(window.__propertyResizeTimer);
            window.__propertyResizeTimer = window.setTimeout(() => {
                renderFeaturedProperties();
                renderNews();
                renderProgress();
            }, 180);
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
                if (isFeaturedToggleLoading) return;

                const total = filteredProperties().length;
                const initialLimit = getInitialLimit();

                if ((featuredVisibleCount || initialLimit) >= total) {
                    featuredVisibleCount = initialLimit;
                    renderFeaturedProperties();
                } else {
                    const previousCount = featuredVisibleCount || initialLimit;
                    const nextCount = Math.min(previousCount + getShowMoreStep(), total);
                    const items = filteredProperties();

                    isFeaturedToggleLoading = true;
                    updateFeaturedToggleButton(featuredToggle, items, initialLimit, true);

                    window.setTimeout(() => {
                        featuredVisibleCount = nextCount;
                        renderFeaturedProperties({ appendFrom: previousCount });
                        isFeaturedToggleLoading = false;
                    }, 120);
                }
            }

            const newsToggle = event.target.closest("[data-news-toggle]");
            if (newsToggle) {
                if (isNewsToggleLoading) return;

                const total = newsItems.length;
                const initialLimit = getInitialLimit();

                if ((newsVisibleCount || initialLimit) >= total) {
                    newsVisibleCount = initialLimit;
                    renderNews();
                } else {
                    const previousCount = newsVisibleCount || initialLimit;
                    const nextCount = Math.min(previousCount + getShowMoreStep(), total);

                    isNewsToggleLoading = true;
                    updateNewsToggleButton(newsToggle, initialLimit, true);

                    window.setTimeout(() => {
                        newsVisibleCount = nextCount;
                        renderNews({ appendFrom: previousCount });
                        isNewsToggleLoading = false;
                    }, 120);
                }
            }

            const progressToggle = event.target.closest("[data-progress-toggle]");
            if (progressToggle) {
                if (isProgressToggleLoading) return;

                const total = progressItems.length;
                const initialLimit = getInitialLimit();

                if ((progressVisibleCount || initialLimit) >= total) {
                    progressVisibleCount = initialLimit;
                    renderProgress();
                } else {
                    const previousCount = progressVisibleCount || initialLimit;
                    const nextCount = Math.min(previousCount + getShowMoreStep(), total);

                    isProgressToggleLoading = true;
                    updateProgressToggleButton(progressToggle, progressItems, initialLimit, true);

                    window.setTimeout(() => {
                        progressVisibleCount = nextCount;
                        renderProgress({ appendFrom: previousCount });
                        isProgressToggleLoading = false;
                    }, 120);
                }
            }

            const clearFilters = event.target.closest("#clear-property-filters");
            if (clearFilters) resetPropertyFilters();

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

        $$("#property-modal .modal-close, #property-modal .modal-close-action").forEach((button) => {
            button.addEventListener("click", closeModal);
        });
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
        renderPropertySkeletons();

        try {
            properties = normalizeProperties(await loadJson("data/properties.json", "properties-data"));
            populatePropertyFilters();
            renderFeaturedProperties();
            populateInterestedProperty();
            await Promise.all([renderNews(), renderProgress()]);
            updateScrollControls();
            updateSectionNavigation();
        } catch (error) {
            console.error(error);
            const container = $("#featured-properties");
            if (container) {
                container.classList.remove("is-loading");
                container.setAttribute("aria-busy", "false");
                container.innerHTML = `<p class="empty-state"><strong>Property listings are temporarily unavailable.</strong><span>Please refresh the page or try again shortly.</span></p>`;
            }
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
