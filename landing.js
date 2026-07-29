(function () {
    const items = document.querySelectorAll(".feature-item");

    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
        items.forEach(function (item) {
            item.classList.add("is-visible");
        });
        return;
    }

    const observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        { threshold: 0.2, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach(function (item, index) {
        item.style.transitionDelay = index * 80 + "ms";
        observer.observe(item);
    });
})();
