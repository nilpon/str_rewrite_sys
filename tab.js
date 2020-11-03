function tab_page(page_count, item = "", content = "", onactive = null) {
	this.id_page = page_count;
	this.item = item;
	this.content = content;
	this.onactive = onactive;
}

var Tab = new Object();
Tab.tabs = [];
Tab.tab_count = 0;

Tab.new = function(id, tabclass_item = "tab_item", tabclass_item_active = "tab_item_active", tabclass_content = "tab_content") {
		let newtab = new Object();
		
		newtab.id = Tab.tab_count++;
		newtab.area = document.getElementById(id);
		newtab.pages = [];
		newtab.page_active = -1;
		newtab.page_count = 0;
		newtab.tabclass_item = tabclass_item;
		newtab.tabclass_item_active = tabclass_item_active;
		newtab.tabclass_content = tabclass_content;

		let tab_menu_area = document.createElement("div");
		tab_menu_area.style.display = "flex";
		tab_menu_area.setAttribute("id", "tab_menu" + newtab.id);
		newtab.area.appendChild(tab_menu_area);

		let tab_content_area = document.createElement("div");
		tab_content_area.setAttribute("id", "tab_content" + newtab.id);
		tab_content_area.setAttribute("class", tabclass_content);
		newtab.area.appendChild(tab_content_area);

		Tab.tabs.push(newtab);

		return newtab.id;
};

Tab.newpage = function(id_tab, tab_title = "", tab_content = "", onactive = null) {
		let mytab = Tab.tabs.find((v) => v.id === id_tab);

		if(!mytab) return;

		let new_page = new tab_page(mytab.page_count, tab_title, tab_content, onactive);
		
		new_page.tab_item_area = document.createElement("div");
		new_page.tab_item_area.setAttribute("class", mytab.tabclass_item);
		new_page.tab_item_area.setAttribute("id", "tab_item" + mytab.id + "_" + new_page.id_page);
		new_page.tab_item_area.setAttribute("id_tab", mytab.id);
		new_page.tab_item_area.setAttribute("id_page", new_page.id_page);
		new_page.tab_item_area.innerHTML = tab_title;
		new_page.tab_item_area.addEventListener("click", function(){Tab.onclick(this.attributes.id_tab.value, this.attributes.id_page.value)});
		document.getElementById("tab_menu" + mytab.id).appendChild(new_page.tab_item_area);
		mytab.pages.push(new_page);

		return mytab.page_count++;
};

Tab.onclick = function(id_tab, id_page) {
		let mytab = Tab.tabs.find((v) => v.id == id_tab);

		if(!mytab) return;
		let clicked_page = mytab.pages.find((v) => v.id_page == id_page);
		if(!clicked_page) return;
		if(mytab.page_active !== clicked_page.id_page) {
			let last_active_page = mytab.pages.find((v) => v.id_page === mytab.page_active);
			if(last_active_page) {
				last_active_page.tab_item_area.setAttribute("class", mytab.tabclass_item);
				last_active_page.content = document.getElementById("tab_content" + mytab.id).innerHTML;
			}

			mytab.page_active = clicked_page.id_page;
			clicked_page.tab_item_area.setAttribute("class", mytab.tabclass_item_active);

			document.getElementById("tab_content" + mytab.id).innerHTML = clicked_page.content;
			if(clicked_page.onactive) clicked_page.onactive();
		}
};
